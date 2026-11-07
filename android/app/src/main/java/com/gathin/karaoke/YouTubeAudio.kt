package com.gathin.karaoke

import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.stream.StreamInfo
import java.util.concurrent.ConcurrentHashMap

data class YouTubeAudioInfo(
    val url: String,
    val mime: String,
    val duration: Long,
    val title: String,
)

object YouTubeAudio {
    private val cache = ConcurrentHashMap<String, Pair<Long, YouTubeAudioInfo>>()

    fun resolve(videoId: String): YouTubeAudioInfo? {
        if (!videoId.matches(Regex("[A-Za-z0-9_-]{11}"))) return null
        cache[videoId]?.let { (time, value) ->
            if (System.currentTimeMillis() - time < 10 * 60_000L) return value
        }
        return try {
            YouTubeSearch.ensureInitialized()
            val info = StreamInfo.getInfo(ServiceList.YouTube, "https://www.youtube.com/watch?v=$videoId")
            val audio = info.audioStreams.firstOrNull() ?: return null
            YouTubeAudioInfo(audio.content, audio.format?.mimeType ?: "audio/mp4", info.duration, info.name).also {
                cache[videoId] = System.currentTimeMillis() to it
            }
        } catch (_: Exception) {
            null
        }
    }
}
