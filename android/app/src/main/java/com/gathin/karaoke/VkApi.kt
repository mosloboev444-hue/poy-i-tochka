package com.gathin.karaoke

import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

data class VkTrack(
    val ownerId: Long,
    val id: Long,
    val title: String,
    val duration: Long,
    val thumbnail: String?,
    val embedUrl: String,
    val webpageUrl: String,
)

object VkApi {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    fun search(query: String, token: String, limit: Int = 6): List<VkTrack> {
        if (query.isBlank() || token.isBlank()) return emptyList()
        return try {
            val url = "https://api.vk.com/method/video.search" +
                "?q=${URLEncoder.encode(query, "UTF-8")}" +
                "&count=$limit&sort=2&extended=1&v=5.199" +
                "&access_token=${URLEncoder.encode(token, "UTF-8")}"
            val root = getJson(url) ?: return emptyList()
            if (root.has("error")) return emptyList()
            val items = root.optJSONObject("response")?.optJSONArray("items") ?: return emptyList()
            val tracks = mutableListOf<VkTrack>()
            for (index in 0 until items.length()) {
                val item = items.optJSONObject(index) ?: continue
                if (item.optBoolean("is_private")) continue
                if (item.optBoolean("live")) continue
                val id = item.optLong("id")
                val ownerId = item.optLong("owner_id")
                val title = item.optString("title")
                val duration = item.optLong("duration")
                if (id == 0L || ownerId == 0L || title.isBlank()) continue
                if (duration !in 45..1200) continue
                val player = item.optString("player")
                val embed = player.ifBlank {
                    "https://vk.com/video_ext.php?oid=$ownerId&id=$id"
                }
                tracks.add(
                    VkTrack(
                        ownerId = ownerId,
                        id = id,
                        title = title,
                        duration = duration,
                        thumbnail = item.optString("photo_640")
                            .ifBlank { item.optString("photo_320") }
                            .ifBlank { item.optString("photo_130") }
                            .takeIf { it.isNotBlank() },
                        embedUrl = embed,
                        webpageUrl = "https://vk.com/video${ownerId}_$id",
                    )
                )
            }
            tracks
        } catch (exc: Exception) {
            emptyList()
        }
    }

    fun validate(token: String): String? {
        if (token.isBlank()) return "Токен пустой"
        return try {
            val url = "https://api.vk.com/method/video.search" +
                "?q=test&count=1&v=5.199" +
                "&access_token=${URLEncoder.encode(token, "UTF-8")}"
            val root = getJson(url) ?: return "VK не ответил"
            val error = root.optJSONObject("error") ?: return null
            val message = error.optString("error_msg", "Неверный токен")
            if (message.contains("access_token", ignoreCase = true) ||
                message.contains("authorization", ignoreCase = true)
            ) {
                "Токен не подошёл: нужен scope video"
            } else {
                message
            }
        } catch (exc: Exception) {
            "Не удалось проверить токен: ${exc.message}"
        }
    }

    private fun getJson(url: String): JSONObject? {
        return try {
            val request = Request.Builder()
                .url(url)
                .header("User-Agent", "PoyITochka/0.2 (Android TV)")
                .build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return null
                JSONObject(response.body?.string().orEmpty())
            }
        } catch (exc: Exception) {
            null
        }
    }
}
