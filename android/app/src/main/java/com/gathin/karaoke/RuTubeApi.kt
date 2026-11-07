package com.gathin.karaoke

import okhttp3.OkHttpClient
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Request
import org.json.JSONObject
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

data class RuTubeTrack(
    val id: String,
    val title: String,
    val author: String,
    val duration: Long,
    val thumbnail: String?,
    val embedUrl: String,
    val webpageUrl: String,
)

object RuTubeApi {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    fun streamUrl(id: String): String? {
        if (id.isBlank()) return null
        return try {
            val request = Request.Builder().url("https://rutube.ru/api/play/options/$id/")
                .header("User-Agent", "Mozilla/5.0 (Linux; Android 14) PoyITochka/0.2")
                .header("Accept", "application/json").build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return null
                val root = JSONObject(response.body?.string().orEmpty())
                val balancer = root.optJSONObject("video_balancer") ?: return null
                val master = balancer.optString("default").ifBlank { balancer.optString("m3u8") }
                    .takeIf { it.isNotBlank() } ?: return null
                lowestVariant(master) ?: master
            }
        } catch (_: Exception) { null }
    }

    private fun lowestVariant(masterUrl: String): String? {
        val text = try {
            val req = Request.Builder().url(masterUrl)
                .header("User-Agent", "Mozilla/5.0 (Linux; Android 14) PoyITochka/0.2").build()
            client.newCall(req).execute().use { response ->
                if (!response.isSuccessful) return null
                response.body?.string().orEmpty()
            }
        } catch (_: Exception) { return null }
        val base = masterUrl.toHttpUrlOrNull() ?: return null
        var bandwidth = Long.MAX_VALUE
        var height = 0
        var bestBandwidth = Long.MAX_VALUE
        var bestHeight = 0
        var best: String? = null
        for (line in text.lineSequence().map(String::trim)) {
            if (line.startsWith("#EXT-X-STREAM-INF")) {
                Regex("BANDWIDTH=(\\d+)").find(line)?.groupValues?.get(1)?.toLongOrNull()?.let { bandwidth = it }
                Regex("RESOLUTION=(\\d+)x(\\d+)").find(line)?.groupValues?.get(2)?.toIntOrNull()?.let { height = it }
                continue
            }
            if (line.isBlank() || line.startsWith("#") || bandwidth == Long.MAX_VALUE) continue
            val score = if (height == 480) 0 else if (height in 360..480) 1 else 2
            val oldScore = if (bestHeight == 480) 0 else if (bestHeight in 360..480) 1 else 2
            if (best == null || score < oldScore || (score == oldScore && bandwidth < bestBandwidth)) {
                bestBandwidth = bandwidth; bestHeight = height; best = base.resolve(line)?.toString()
            }
            bandwidth = Long.MAX_VALUE; height = 0
        }
        return best
    }

    private fun getJson(url: String): JSONObject? {
        return try {
            val request = Request.Builder()
                .url(url)
                .header("User-Agent", "Mozilla/5.0 (Linux; Android 14) PoyITochka/0.1")
                .header("Accept", "application/json")
                .build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return null
                JSONObject(response.body?.string().orEmpty())
            }
        } catch (exc: Exception) {
            null
        }
    }

    fun info(id: String): JSONObject? {
        if (id.isBlank()) return null
        return getJson("https://rutube.ru/api/video/$id/")
    }

    fun search(query: String, limit: Int = 8): List<RuTubeTrack> {
        if (query.isBlank()) return emptyList()
        return try {
            val encoded = URLEncoder.encode(query, "UTF-8")
            val root = getJson("https://rutube.ru/api/search/video/?query=$encoded&limit=$limit") ?: return emptyList()
            val items = root.optJSONArray("results") ?: return emptyList()
            val tracks = mutableListOf<RuTubeTrack>()
            for (index in 0 until items.length()) {
                val item = items.optJSONObject(index) ?: continue
                if (item.optBoolean("is_hidden") || item.optBoolean("is_deleted")) continue
                if (item.optBoolean("is_livestream") || item.optBoolean("is_on_air")) continue
                val id = item.optString("id")
                val title = item.optString("title")
                val embed = item.optString("embed_url")
                val duration = item.optLong("duration")
                if (id.isBlank() || title.isBlank() || embed.isBlank()) continue
                if (duration !in 45..1200) continue
                tracks.add(
                    RuTubeTrack(
                        id = id,
                        title = title,
                        author = item.optJSONObject("author")?.optString("name") ?: "RuTube",
                        duration = duration,
                        thumbnail = item.optString("thumbnail_url").takeIf { it.isNotBlank() },
                        embedUrl = embed,
                        webpageUrl = item.optString("video_url", "https://rutube.ru/video/$id/"),
                    )
                )
            }
            tracks
        } catch (exc: Exception) {
            emptyList()
        }
    }
}
