package com.gathin.karaoke

import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

object LinkResolver {
    private val client = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    private val youtube = Regex(
        "(?:youtube\\.com/(?:watch\\?[^#]*v=|shorts/|embed/)|youtu\\.be/)([A-Za-z0-9_-]{11})"
    )
    private val rutube = Regex("rutube\\.ru/(?:video|play/embed)/([A-Za-z0-9]+)")
    private val vk = Regex("(?:vk\\.com|vkvideo\\.ru)/video(-?\\d+)_(\\d+)")

    fun resolve(raw: String): JSONObject? {
        val input = raw.trim()
        if (input.isBlank()) return null

        youtube.find(input)?.groupValues?.get(1)?.let { id ->
            return youtubeTrack(id)
        }
        rutube.find(input)?.groupValues?.get(1)?.let { id ->
            return rutubeTrack(id)
        }
        vk.find(input)?.let { match ->
            return vkTrack(match.groupValues[1].toLongOrNull() ?: return null, match.groupValues[2])
        }
        // A bare YouTube id is convenient for TV keyboards.
        if (input.matches(Regex("[A-Za-z0-9_-]{11}"))) return youtubeTrack(input)
        if (input.matches(Regex("[A-Za-z0-9]{20,}"))) return rutubeTrack(input)
        return null
    }

    private fun youtubeTrack(id: String): JSONObject {
        val page = "https://www.youtube.com/watch?v=$id"
        var title = "YouTube по ссылке"
        var artist = "YouTube"
        var duration = 0.0
        var thumbnail: String? = "https://i.ytimg.com/vi/$id/mqdefault.jpg"
        runCatching {
            val url = "https://www.youtube.com/oembed?format=json&url=" +
                URLEncoder.encode(page, "UTF-8")
            val request = Request.Builder().url(url).header("User-Agent", "PoyITochka/0.3").build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@use
                val root = JSONObject(response.body?.string().orEmpty())
                title = root.optString("title", title)
                artist = root.optString("author_name", artist)
                thumbnail = root.optString("thumbnail_url").ifBlank { thumbnail }
            }
        }
        val track = JSONObject()
            .put("id", "youtube:$id")
            .put("source", "youtube")
            .put("video_id", id)
            .put("title", title)
            .put("raw_title", title)
            .put("artist", artist)
            .put("duration", duration)
            .put("thumbnail", thumbnail ?: JSONObject.NULL)
            .put("stream_url", JSONObject.NULL)
            .put("instrumental_url", JSONObject.NULL)
            .put("embed_url", "https://www.youtube.com/embed/$id?enablejsapi=1&rel=0&modestbranding=1&playsinline=1")
            .put("webpage_url", page)
            .put("is_karaoke", true)
            .put("is_instrumental", true)
            .put("license", "YouTube (personal use)")
            .put("provider", "YouTube")
        attachLyrics(track, title, artist, duration)
        return track
    }

    private fun rutubeTrack(id: String): JSONObject {
        var title = "RuTube по ссылке"
        var artist = "RuTube"
        var duration = 0.0
        var thumbnail: String? = null
        runCatching {
            val root = RuTubeApi.info(id) ?: return@runCatching
            title = root.optString("title", title)
            artist = root.optJSONObject("author")?.optString("name").orEmpty().ifBlank { artist }
            duration = root.optDouble("duration", 0.0)
            thumbnail = root.optString("thumbnail_url").ifBlank { null }
        }
        val track = JSONObject()
            .put("id", "rutube:$id")
            .put("source", "rutube")
            .put("title", title)
            .put("raw_title", title)
            .put("artist", artist)
            .put("duration", duration)
            .put("thumbnail", thumbnail ?: JSONObject.NULL)
            .put("stream_url", JSONObject.NULL)
            .put("instrumental_url", JSONObject.NULL)
            .put("embed_url", "https://rutube.ru/play/embed/$id")
            .put("webpage_url", "https://rutube.ru/video/$id/")
            .put("is_karaoke", true)
            .put("is_instrumental", true)
            .put("license", "RuTube (personal use)")
            .put("provider", "RuTube")
        attachLyrics(track, title, artist, duration)
        return track
    }

    private fun vkTrack(ownerId: Long, videoId: String): JSONObject {
        val id = videoId.toLongOrNull() ?: return JSONObject()
        return JSONObject()
            .put("id", "vk:${ownerId}_$id")
            .put("source", "vk")
            .put("title", "VK Видео по ссылке")
            .put("raw_title", "VK Видео по ссылке")
            .put("artist", "VK Video")
            .put("duration", 0)
            .put("thumbnail", JSONObject.NULL)
            .put("stream_url", JSONObject.NULL)
            .put("instrumental_url", JSONObject.NULL)
            .put(
                "embed_url",
                "https://vk.com/video_ext.php?oid=$ownerId&id=$id&hd=2"
            )
            .put("webpage_url", "https://vkvideo.ru/video${ownerId}_$id")
            .put("is_karaoke", false)
            .put("is_instrumental", false)
            .put("license", "VK Video (personal use)")
            .put("provider", "VK Video")
    }

    private fun attachLyrics(track: JSONObject, title: String, artist: String, duration: Double) {
        val lyrics = LyricsApi.lrclibFind(title, artist, duration) ?: return
        track.put("lyrics_id", lyrics.optInt("id"))
        track.put("has_lyrics", true)
        track.put(
            "has_synced_lyrics",
            lyrics.optBoolean("hasSyncedLyrics") || lyrics.optString("syncedLyrics").isNotBlank()
        )
    }
}
