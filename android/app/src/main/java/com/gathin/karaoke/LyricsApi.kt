package com.gathin.karaoke

import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

object LyricsApi {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    fun cleanQuery(query: String): String =
        query.replace(Regex("(?i)\\b(karaoke|караоке|minus|минус|instrumental|backing track|playback)\\b"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
            .ifBlank { query }

    fun lrclibSearch(query: String): JSONArray {
        if (query.isBlank()) return JSONArray()
        val url = "https://lrclib.net/api/v2/search?q=${enc(query)}"
        return getJson(url) as? JSONArray ?: JSONArray()
    }

    fun lrclibGet(id: Int): JSONObject? =
        getJson("https://lrclib.net/api/get/$id") as? JSONObject

    fun lrclibFind(title: String, artist: String?, duration: Double?): JSONObject? {
        if (title.isBlank()) return null
        val params = buildString {
            append("track_name=").append(enc(title))
            if (!artist.isNullOrBlank() && artist != "Local file") append("&artist_name=").append(enc(artist))
        }
        val records = getJson("https://lrclib.net/api/search?$params") as? JSONArray ?: return null
        return bestRecord(records, title, artist, duration)
    }

    fun bestRecord(records: JSONArray, title: String, artist: String?, duration: Double?): JSONObject? {
        if (records.length() == 0) return null
        val all = (0 until records.length()).mapNotNull { records.optJSONObject(it) }
        val synced = all.filter {
            it.optBoolean("hasSyncedLyrics") || it.optString("syncedLyrics").isNotBlank()
        }
        val pools = if (synced.isNotEmpty()) listOf(synced, all) else listOf(all)
        for (pool in pools) {
            var best: JSONObject? = null
            var bestScore = -1.0
            for (record in pool) {
                val recTitle = record.optString("trackName", record.optString("name", ""))
                val recArtist = record.optString("artistName", "")
                val titleScore = similarity(norm(title), norm(recTitle))
                val artistScore = similarity(norm(artist ?: ""), norm(recArtist))
                val recDuration = record.optDouble("duration", 0.0)
                val durationScore = if (duration != null && duration > 0 && recDuration > 0) {
                    (1.0 - kotlin.math.abs(duration - recDuration) / 12.0).coerceIn(0.0, 1.0)
                } else 0.5
                val score = if (!artist.isNullOrBlank()) {
                    0.62 * titleScore + 0.23 * artistScore + 0.15 * durationScore
                } else {
                    0.85 * titleScore + 0.15 * durationScore
                }
                if (score > bestScore) {
                    bestScore = score
                    best = record
                }
            }
            if (best != null && bestScore >= 0.5) return best
        }
        return null
    }

    fun attachLyrics(track: MutableMap<String, Any?>, records: JSONArray) {
        val title = track["title"] as? String ?: return
        val artist = track["artist"] as? String
        val duration = (track["duration"] as? Number)?.toDouble()
        val record = bestRecord(records, title, artist, duration) ?: return
        track["lyrics_id"] = record.optInt("id")
        track["has_lyrics"] = true
        track["has_synced_lyrics"] = record.optBoolean("hasSyncedLyrics") ||
            !record.optString("syncedLyrics").isNullOrBlank()
        track["lyrics_track"] = record.optString("trackName")
        track["lyrics_artist"] = record.optString("artistName")
        record.optString("albumName").takeIf { it.isNotBlank() }?.let { track["album"] = it }
        record.optString("artistName").takeIf { it.isNotBlank() }?.let { track["author"] = it }
    }

    fun norm(value: String): String =
        value.lowercase()
            .replace(Regex("\\([^)]*\\)|\\[[^]]*\\]"), " ")
            .replace(Regex("[^a-zа-я0-9]+"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()

    fun similarity(a: String, b: String): Double {
        if (a == b) return 1.0
        if (a.isBlank() || b.isBlank()) return 0.0
        val left = a.split(' ').filter { it.isNotBlank() }.toSet()
        val right = b.split(' ').filter { it.isNotBlank() }.toSet()
        if (left.isEmpty() || right.isEmpty()) return 0.0
        val intersection = left.intersect(right).size.toDouble()
        val union = left.union(right).size.toDouble()
        return intersection / union
    }

    private fun enc(value: String): String = URLEncoder.encode(value, "UTF-8")

    private fun getJson(url: String): Any? {
        return try {
            val request = Request.Builder()
                .url(url)
                .header("User-Agent", "PoyITochka/0.1 (Android TV)")
                .build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return null
                val body = response.body?.string() ?: return null
                if (body.trimStart().startsWith("[")) JSONArray(body) else JSONObject(body)
            }
        } catch (exc: Exception) {
            null
        }
    }
}
