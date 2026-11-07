package com.gathin.karaoke

import android.content.Context
import android.media.MediaMetadataRetriever
import fi.iki.elonen.NanoHTTPD
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class LocalServer(context: Context, port: Int = 8787) : NanoHTTPD(port) {
    private val appContext = context.applicationContext
    private val tracksDir = File(appContext.filesDir, "tracks").apply { mkdirs() }
    private val uploadsDir = File(appContext.filesDir, "uploads").apply { mkdirs() }
    private val vkTokenFile = File(appContext.filesDir, "vk_token.txt")
    private val searchPool = Executors.newFixedThreadPool(4)
    private val searchCache = ConcurrentHashMap<String, Pair<Long, String>>()
    private val lyricsCache = ConcurrentHashMap<String, Pair<Long, JSONArray>>()
    private val karaokeCache = ConcurrentHashMap<String, Pair<Long, JSONArray>>()

    override fun serve(session: IHTTPSession): Response {
        return try {
            when {
                session.uri == "/api/health" -> json(health())
                session.uri == "/api/vk/token" -> vkTokenResponse(session)
                session.uri == "/api/rutube/stream" -> rutubeStream(session)
                session.uri == "/api/youtube/audio" -> youtubeAudio(session)
                session.uri == "/api/search" -> json(search(session))
                session.uri == "/api/search/youtube" -> json(searchProvider(session, "youtube"))
                session.uri == "/api/search/rutube" -> json(searchProvider(session, "rutube"))
                session.uri == "/api/karaoke" -> json(karaokeCatalog(session))
                session.uri == "/api/lyrics" -> lyrics(session)
                session.uri == "/api/link" -> link(session)
                session.uri == "/api/catalog" -> json(JSONObject().put("tracks", CatalogStore.tracks(appContext)))
                session.uri == "/api/catalog/delete" -> {
                    val pack = session.parameters["pack"]?.firstOrNull().orEmpty()
                    val deleted = CatalogStore.deletePack(appContext, pack)
                    json(
                        JSONObject().put("ok", deleted),
                        if (deleted) Response.Status.OK else Response.Status.BAD_REQUEST
                    )
                }
                session.uri == "/api/local/lyrics" -> localLyrics(session)
                session.uri == "/api/import" -> json(importAudio(session))
                session.uri.startsWith("/api/tracks/") -> trackResponse(session)
                session.uri.startsWith("/media/") -> media(session)
                else -> asset(session)
            }
        } catch (exc: Exception) {
            json(JSONObject().put("detail", exc.message ?: exc.javaClass.simpleName), Response.Status.INTERNAL_ERROR)
        }
    }

    private fun health(): JSONObject = JSONObject().apply {
        put("ok", true)
        put("standalone", true)
        put("youtube", true)
        put("rutube", true)
        put("vk", vkToken().isNotBlank())
        put("lrclib", true)
        put("catalog", CatalogStore.tracks(appContext).length())
        put("version", BuildConfig.VERSION_NAME)
        put("build", BuildConfig.VERSION_CODE)
        put("separator", false)
    }

    private fun vkToken(): String =
        runCatching { if (vkTokenFile.isFile) vkTokenFile.readText().trim() else "" }.getOrDefault("")

    private fun vkTokenResponse(session: IHTTPSession): Response {
        val token = session.headers["x-vk-token"]?.trim().orEmpty()
        if (token.isBlank()) {
            return json(JSONObject().put("detail", "Пустой токен"), Response.Status.BAD_REQUEST)
        }
        val error = VkApi.validate(token)
        if (error != null) {
            return json(JSONObject().put("detail", error), Response.Status.BAD_REQUEST)
        }
        vkTokenFile.writeText(token)
        return json(JSONObject().put("ok", true).put("vk", true))
    }

    private fun rutubeStream(session: IHTTPSession): Response {
        val id = session.parameters["id"]?.firstOrNull().orEmpty()
        val url = RuTubeApi.streamUrl(id)
            ?: return json(JSONObject().put("detail", "RuTube stream not found"), Response.Status.NOT_FOUND)
        return json(JSONObject().put("url", url))
    }

    private fun youtubeAudio(session: IHTTPSession): Response {
        val id = session.parameters["id"]?.firstOrNull().orEmpty()
        val info = YouTubeAudio.resolve(id)
            ?: return json(JSONObject().put("detail", "YouTube audio not found"), Response.Status.NOT_FOUND)
        return json(JSONObject().apply {
            put("url", info.url)
            put("mime", info.mime)
            put("duration", info.duration)
            put("title", info.title)
        })
    }

    private fun karaokeQueries(lang: String, batch: Int): List<String> {
        val groups = if (lang == "ru") {
            listOf(
                listOf("караоке русские песни", "караоке хиты", "караоке ретро"),
                listOf("караоке 90-х", "караоке 80-х", "караоке шансон"),
                listOf("караоке рок", "караоке поп", "караоке военные песни"),
                listOf("караоке застольные", "караоке новогодние", "караоке любимые"),
                listOf("караоке народные", "караоке эстрада", "караоке дворовые")
            )
        } else {
            listOf(
                listOf("karaoke english songs", "karaoke hits", "karaoke 80s 90s"),
                listOf("karaoke rock", "karaoke pop", "karaoke love songs"),
                listOf("karaoke country", "karaoke disney", "karaoke musicals"),
                listOf("karaoke christmas", "karaoke duets", "karaoke classics"),
                listOf("karaoke acoustic", "karaoke party", "karaoke ballads")
            )
        }
        return groups.getOrElse(batch) { emptyList() }
    }

    private fun karaokeCatalog(session: IHTTPSession): JSONObject {
        val lang = if (session.parameters["lang"]?.firstOrNull() == "en") "en" else "ru"
        val limit = (session.parameters["limit"]?.firstOrNull()?.toIntOrNull() ?: 100).coerceIn(20, 120)
        val batch = (session.parameters["batch"]?.firstOrNull()?.toIntOrNull() ?: 0).coerceIn(0, 4)
        val refresh = session.parameters["refresh"]?.firstOrNull() == "1"
        val cacheKey = "$lang:$limit:$batch"
        if (!refresh) {
            karaokeCache[cacheKey]?.let { (savedAt, cached) ->
                if (System.currentTimeMillis() - savedAt < 10 * 60_000L) {
                    return JSONObject()
                        .put("lang", lang)
                        .put("batch", batch)
                        .put("hasMore", batch < 4)
                        .put("results", cached)
                }
            }
        }

        val queries = karaokeQueries(lang, batch)
        val results = mutableListOf<JSONObject>()
        for (query in queries) {
            for (track in YouTubeSearch.search(query, 40)) {
                val json = toJson(youtubeTrack(track))
                if (results.none { it.optString("id") == json.optString("id") }) results.add(json)
            }
            for (track in RuTubeApi.search(query, 10)) {
                val json = toJson(rutubeTrack(track))
                if (results.none { it.optString("id") == json.optString("id") }) results.add(json)
            }
            if (results.size >= limit) break
        }
        val payload = JSONArray(results.take(limit))
        karaokeCache[cacheKey] = System.currentTimeMillis() to payload
        return JSONObject()
            .put("lang", lang)
            .put("batch", batch)
            .put("hasMore", batch < 4)
            .put("results", payload)
    }

    private fun cachedLyrics(query: String): JSONArray {
        val key = query.lowercase()
        lyricsCache[key]?.let { (savedAt, cached) ->
            if (System.currentTimeMillis() - savedAt < 10 * 60_000L) return cached
        }
        val fresh = LyricsApi.lrclibSearch(query)
        lyricsCache[key] = System.currentTimeMillis() to fresh
        return fresh
    }

    private fun searchProvider(session: IHTTPSession, provider: String): JSONObject {
        val query = session.parameters["q"]?.firstOrNull()?.trim().orEmpty()
        if (query.isEmpty()) {
            return JSONObject().put("query", "").put("results", JSONArray()).put("provider", provider)
        }
        val lyricsQuery = LyricsApi.cleanQuery(query)
        val videoQuery = if (Regex("(?i)karaoke|караоке|минус|minus|instrumental").containsMatchIn(query)) {
            query
        } else {
            "$query karaoke"
        }
        val lyrics = cachedLyrics(lyricsQuery)
        val results = mutableListOf<JSONObject>()
        if (provider == "youtube") {
            val limit = (session.parameters["limit"]?.firstOrNull()?.toIntOrNull() ?: 8).coerceIn(1, 8)
            for (track in YouTubeSearch.search(videoQuery, limit)) {
                val map = youtubeTrack(track)
                LyricsApi.attachLyrics(map, lyrics)
                results.add(toJson(map))
            }
        } else {
            for (track in RuTubeApi.search(videoQuery, 6)) {
                val map = rutubeTrack(track)
                LyricsApi.attachLyrics(map, lyrics)
                results.add(toJson(map))
            }
        }
        val sorted = results.sortedWith(
            compareBy<JSONObject>(
                { if (it.optBoolean("is_karaoke")) 0 else 1 },
                { if (it.optBoolean("has_synced_lyrics")) 0 else 1 }
            )
        )
        return JSONObject()
            .put("query", query)
            .put("provider", provider)
            .put("results", JSONArray(sorted))
    }

    private fun search(session: IHTTPSession): JSONObject {
        val query = session.parameters["q"]?.firstOrNull()?.trim().orEmpty()
        val limit = session.parameters["limit"]?.firstOrNull()?.toIntOrNull()?.coerceIn(4, 20) ?: 10
        if (query.isEmpty()) {
            return JSONObject().put("query", "").put("results", JSONArray()).put("providers", JSONObject())
        }
        val lyricsQuery = LyricsApi.cleanQuery(query)
        val videoQuery = if (Regex("(?i)karaoke|караоке|минус|minus|instrumental").containsMatchIn(query)) {
            query
        } else {
            "$query karaoke"
        }
        val cacheKey = "$videoQuery|$limit"
        searchCache[cacheKey]?.let { (savedAt, cached) ->
            if (System.currentTimeMillis() - savedAt < 5 * 60_000L) {
                return JSONObject(cached)
            }
        }

        val youtubeFuture = searchPool.submit<List<YouTubeTrack>> {
            YouTubeSearch.search(videoQuery, limit.coerceAtMost(8))
        }
        val rutubeFuture = searchPool.submit<List<RuTubeTrack>> {
            RuTubeApi.search(videoQuery, 6)
        }
        val lyricsFuture = searchPool.submit<JSONArray> {
            LyricsApi.lrclibSearch(lyricsQuery)
        }
        val vkToken = vkToken()
        val vkFuture = if (vkToken.isNotBlank()) {
            searchPool.submit<List<VkTrack>> { VkApi.search(videoQuery, vkToken, 6) }
        } else null

        val lyrics = runCatching { lyricsFuture.get(35, TimeUnit.SECONDS) }.getOrDefault(JSONArray())
        val results = mutableListOf<JSONObject>()
        val youtube = runCatching { youtubeFuture.get(35, TimeUnit.SECONDS) }.getOrDefault(emptyList())
        for (track in youtube) {
            val map = youtubeTrack(track)
            LyricsApi.attachLyrics(map, lyrics)
            results.add(toJson(map))
        }
        val rutube = runCatching { rutubeFuture.get(20, TimeUnit.SECONDS) }.getOrDefault(emptyList())
        for (track in rutube) {
            val map = rutubeTrack(track)
            LyricsApi.attachLyrics(map, lyrics)
            results.add(toJson(map))
        }
        val vk = vkFuture?.let {
            runCatching { it.get(20, TimeUnit.SECONDS) }.getOrDefault(emptyList())
        } ?: emptyList()
        for (track in vk) {
            val map = vkTrack(track)
            LyricsApi.attachLyrics(map, lyrics)
            results.add(toJson(map))
        }
        val sorted = results.sortedWith(
            compareBy<JSONObject>(
                { if (it.optBoolean("is_karaoke")) 0 else 1 },
                { when (it.optString("source")) { "rutube" -> 0; "vk" -> 1; "youtube" -> 2; else -> 3 } },
                { if (it.optBoolean("has_synced_lyrics")) 0 else 1 },
            )
        )
        val response = JSONObject().apply {
            put("query", query)
            put("results", JSONArray(sorted))
            put("providers", JSONObject().put("youtube", results.any { it.optString("source") == "youtube" })
                .put("rutube", results.any { it.optString("source") == "rutube" })
                .put("vk", results.any { it.optString("source") == "vk" })
                .put("lrclib", true))
        }
        searchCache[cacheKey] = System.currentTimeMillis() to response.toString()
        return response
    }

    private fun localLyrics(session: IHTTPSession): Response {
        val pack = session.parameters["pack"]?.firstOrNull().orEmpty()
        val file = session.parameters["file"]?.firstOrNull().orEmpty()
        val text = CatalogStore.lyrics(appContext, pack, file)
            ?: return json(JSONObject().put("detail", "Текст не найден"), Response.Status.NOT_FOUND)
        return json(JSONObject().put("syncedLyrics", text).put("plainLyrics", text))
    }

    private fun link(session: IHTTPSession): Response {
        val url = session.parameters["url"]?.firstOrNull()?.trim().orEmpty()
        if (url.isBlank()) {
            return json(JSONObject().put("detail", "Пустая ссылка"), Response.Status.BAD_REQUEST)
        }
        val track = LinkResolver.resolve(url)
            ?: return json(
                JSONObject().put("detail", "Поддерживаются ссылки YouTube, RuTube и VK Видео"),
                Response.Status.BAD_REQUEST
            )
        return json(JSONObject().put("track", track))
    }

    private fun lyrics(session: IHTTPSession): Response {        val params = session.parameters
        val id = params["id"]?.firstOrNull()?.toIntOrNull()
        var record: JSONObject? = if (id != null) LyricsApi.lrclibGet(id) else null
        if (record == null) {
            val title = params["track"]?.firstOrNull().orEmpty()
            val artist = params["artist"]?.firstOrNull()
            val duration = params["duration"]?.firstOrNull()?.toDoubleOrNull()
            if (title.isNotBlank()) record = LyricsApi.lrclibFind(title, artist, duration)
        }
        if (record == null) {
            return json(JSONObject().put("detail", "Lyrics not found"), Response.Status.NOT_FOUND)
        }
        return json(JSONObject(record.toString()))
    }

    private fun importAudio(session: IHTTPSession): JSONObject {
        val files = HashMap<String, String>()
        session.parseBody(files)
        val tmpPath = files["file"] ?: throw IllegalArgumentException("No file uploaded")
        val originalName = session.parameters["file"]?.firstOrNull()
            ?: File(tmpPath).name
        val extension = originalName.substringAfterLast('.', "mp3").lowercase()
        val allowed = setOf("mp3", "flac", "wav", "m4a", "aac", "ogg", "opus")
        if (extension !in allowed) throw IllegalArgumentException("Unsupported format: $extension")
        val storedName = "${UUID.randomUUID()}.$extension"
        val target = File(uploadsDir, storedName)
        File(tmpPath).copyTo(target, overwrite = true)

        var title = originalName.substringBeforeLast('.')
        var artist = "Local file"
        var duration = 0.0
        runCatching {
            val retriever = MediaMetadataRetriever()
            retriever.setDataSource(target.absolutePath)
            retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE)?.let { title = it }
            retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST)?.let { artist = it }
            val ms = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
            duration = ms / 1000.0
            retriever.release()
        }
        if (title.isBlank()) title = originalName.substringBeforeLast('.')

        val track = mutableMapOf<String, Any?>(
            "id" to "local:${UUID.randomUUID().toString().replace("-", "")}",
            "source" to "local",
            "title" to title,
            "raw_title" to originalName,
            "artist" to artist,
            "duration" to duration,
            "thumbnail" to null,
            "stream_url" to "/media/uploads/$storedName",
            "instrumental_url" to null,
            "embed_url" to null,
            "webpage_url" to null,
            "is_karaoke" to false,
            "is_instrumental" to false,
            "license" to "Local file",
            "provider" to "Импорт",
            "file_name" to originalName,
        )
        val lyrics = LyricsApi.lrclibFind(title, artist, duration)
        if (lyrics != null) {
            track["lyrics_id"] = lyrics.optInt("id")
            track["has_lyrics"] = true
            track["has_synced_lyrics"] = lyrics.optBoolean("hasSyncedLyrics") ||
                lyrics.optString("syncedLyrics").isNotBlank()
        }
        val json = toJson(track)
        trackFile(track["id"] as String).writeText(json.toString())
        return json
    }

    private fun trackResponse(session: IHTTPSession): Response {
        val id = session.uri.removePrefix("/api/tracks/")
        if (id.endsWith("/separate")) {
            return json(
                JSONObject().put("detail", "On-device separation is not available yet"),
                Response.Status.NOT_IMPLEMENTED
            )
        }
        val file = trackFile(id)
        if (!file.exists()) return json(JSONObject().put("detail", "Track not found"), Response.Status.NOT_FOUND)
        return json(JSONObject(file.readText()))
    }

    private fun media(session: IHTTPSession): Response {
        val relative = session.uri.removePrefix("/media/").substringBefore('?')
        val file = File(appContext.filesDir, relative)
        val canonical = file.canonicalFile
        if (!canonical.path.startsWith(appContext.filesDir.canonicalPath) || !canonical.isFile) {
            return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "Not found")
        }
        val mime = mimeOf(canonical.name)
        return newChunkedResponse(Response.Status.OK, mime, canonical.inputStream())
    }

    private fun asset(session: IHTTPSession): Response {
        var path = session.uri.substringBefore('?')
        if (path == "/") path = "/index.html"
        val assetPath = "web$path"
        val stream = try {
            appContext.assets.open(assetPath)
        } catch (exc: Exception) {
            if (!path.contains('.')) {
                runCatching { appContext.assets.open("web/index.html") }.getOrNull()
            } else null
        } ?: return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "Not found")
        return newChunkedResponse(Response.Status.OK, mimeOf(path), stream).apply {
            addHeader("Cache-Control", "no-cache")
        }
    }

    private fun trackFile(id: String): File = File(tracksDir, "${id.replace(':', '_')}.json")

    private fun youtubeTrack(track: YouTubeTrack): MutableMap<String, Any?> {
        val karaoke = Regex("(?i)karaoke|караоке|минус|minus|instrumental|backing\\s*track")
            .containsMatchIn(track.title)
        val meta = splitMeta(track.title, track.uploader)
        return mutableMapOf(
            "id" to "youtube:${track.videoId}",
            "source" to "youtube",
            "video_id" to track.videoId,
            "title" to meta.first,
            "raw_title" to track.title,
            "artist" to meta.second,
            "duration" to track.duration,
            "thumbnail" to track.thumbnail,
            "stream_url" to null,
            "instrumental_url" to null,
            "embed_url" to "https://www.youtube.com/embed/${track.videoId}?enablejsapi=1&rel=0&modestbranding=1&playsinline=1",
            "webpage_url" to "https://www.youtube.com/watch?v=${track.videoId}",
            "is_karaoke" to karaoke,
            "is_instrumental" to karaoke,
            "license" to "YouTube (personal use)",
            "provider" to "YouTube",
        )
    }

    private fun rutubeTrack(track: RuTubeTrack): MutableMap<String, Any?> {
        val karaoke = Regex("(?i)karaoke|караоке|минус|minus|instrumental|backing\\s*track")
            .containsMatchIn(track.title)
        val meta = splitMeta(track.title, track.author)
        return mutableMapOf(
            "id" to "rutube:${track.id}",
            "source" to "rutube",
            "title" to meta.first,
            "raw_title" to track.title,
            "artist" to meta.second,
            "duration" to track.duration,
            "thumbnail" to track.thumbnail,
            "stream_url" to null,
            "instrumental_url" to null,
            "embed_url" to track.embedUrl,
            "webpage_url" to track.webpageUrl,
            "is_karaoke" to karaoke,
            "is_instrumental" to karaoke,
            "license" to "RuTube (personal use)",
            "provider" to "RuTube",
        )
    }

    private fun vkTrack(track: VkTrack): MutableMap<String, Any?> {
        val karaoke = Regex("(?i)karaoke|караоке|минус|minus|instrumental|backing\\s*track")
            .containsMatchIn(track.title)
        val meta = splitMeta(track.title, "VK Video")
        return mutableMapOf(
            "id" to "vk:${track.ownerId}_${track.id}",
            "source" to "vk",
            "title" to meta.first,
            "raw_title" to track.title,
            "artist" to meta.second,
            "duration" to track.duration,
            "thumbnail" to track.thumbnail,
            "stream_url" to null,
            "instrumental_url" to null,
            "embed_url" to track.embedUrl,
            "webpage_url" to track.webpageUrl,
            "is_karaoke" to karaoke,
            "is_instrumental" to karaoke,
            "license" to "VK Video (personal use)",
            "provider" to "VK Video",
        )
    }

    private fun splitMeta(title: String, uploader: String): Pair<String, String> {
        val cleaned = title
            .replace(Regex("\\([^)]*\\)|\\[[^]]*\\]"), " ")
            .replace(Regex("(?i)\\b(karaoke|караоке|minus|минус|instrumental|backing track|lyrics)\\b"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
        val separator = cleaned.indexOf(" - ")
        if (separator in 1..60) {
            return cleaned.substring(separator + 3).trim() to cleaned.substring(0, separator).trim()
        }
        val artist = uploader
            .replace(Regex("(?i)\\s*-\\s*topic$"), "")
            .replace(Regex("(?i)\\s*vevo$"), "")
            .trim()
        return cleaned.ifBlank { title } to artist.ifBlank { "YouTube" }
    }

    private fun toJson(map: Map<String, Any?>): JSONObject {
        val obj = JSONObject()
        for ((key, value) in map) obj.put(key, value ?: JSONObject.NULL)
        return obj
    }

    private fun json(obj: JSONObject, status: Response.Status = Response.Status.OK): Response =
        newFixedLengthResponse(status, "application/json; charset=utf-8", obj.toString())

    private fun mimeOf(name: String): String = when (name.substringAfterLast('.', "").lowercase()) {
        "html" -> "text/html; charset=utf-8"
        "js" -> "text/javascript; charset=utf-8"
        "css" -> "text/css; charset=utf-8"
        "json" -> "application/json; charset=utf-8"
        "svg" -> "image/svg+xml"
        "png" -> "image/png"
        "jpg", "jpeg" -> "image/jpeg"
        "webp" -> "image/webp"
        "mp3" -> "audio/mpeg"
        "m4a" -> "audio/mp4"
        "wav" -> "audio/wav"
        "ogg", "opus" -> "audio/ogg"
        "flac" -> "audio/flac"
        "lrc" -> "text/plain; charset=utf-8"
        else -> "application/octet-stream"
    }
}
