package com.gathin.karaoke

import okhttp3.OkHttpClient
import okhttp3.RequestBody.Companion.toRequestBody
import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.downloader.Downloader
import org.schabi.newpipe.extractor.downloader.Request
import org.schabi.newpipe.extractor.downloader.Response
import org.schabi.newpipe.extractor.services.youtube.linkHandler.YoutubeSearchQueryHandlerFactory
import org.schabi.newpipe.extractor.stream.StreamInfoItem

data class YouTubeTrack(
    val videoId: String,
    val title: String,
    val uploader: String,
    val duration: Long,
    val thumbnail: String?,
)

object YouTubeSearch {
    private val client = OkHttpClient.Builder().build()

    @Volatile
    private var initialized = false

    fun search(query: String, limit: Int = 10): List<YouTubeTrack> {
        if (query.isBlank()) return emptyList()
        ensureInitialized()
        return try {
            val handler = YoutubeSearchQueryHandlerFactory.getInstance()
                .fromQuery(query, emptyList(), "")
            val extractor = ServiceList.YouTube.getSearchExtractor(handler)
            extractor.fetchPage()

            val tracks = mutableListOf<YouTubeTrack>()
            var page = extractor.initialPage
            var pageCount = 0
            while (true) {
                for (item in page.items.filterIsInstance<StreamInfoItem>()) {
                    if (item.duration !in 45..1200) continue
                    val videoId = videoIdOf(item.url) ?: continue
                    if (tracks.any { it.videoId == videoId }) continue
                    tracks.add(
                        YouTubeTrack(
                            videoId = videoId,
                            title = item.name ?: "",
                            uploader = item.uploaderName ?: "YouTube",
                            duration = item.duration,
                            thumbnail = "https://i.ytimg.com/vi/$videoId/mqdefault.jpg",
                        )
                    )
                    if (tracks.size >= limit) return tracks
                }
                if (!page.hasNextPage() || pageCount >= 4) break
                page = extractor.getPage(page.nextPage)
                pageCount++
            }
            tracks
        } catch (exc: Exception) {
            emptyList()
        }
    }

    fun ensureInitialized() {
        if (initialized) return
        synchronized(this) {
            if (initialized) return
            NewPipe.init(NewPipeDownloader(client))
            initialized = true
        }
    }

    private fun videoIdOf(url: String?): String? {
        if (url.isNullOrBlank()) return null
        Regex("[?&]v=([A-Za-z0-9_-]{11})").find(url)?.let { return it.groupValues[1] }
        Regex("youtu\\.be/([A-Za-z0-9_-]{11})").find(url)?.let { return it.groupValues[1] }
        return null
    }

    private class NewPipeDownloader(private val client: OkHttpClient) : Downloader() {
        override fun execute(request: Request): Response {
            val body = request.dataToSend()?.toRequestBody()
            val builder = okhttp3.Request.Builder()
                .url(request.url())
                .method(request.httpMethod(), body)
            request.headers().forEach { (name, values) ->
                values.forEach { builder.addHeader(name, it) }
            }
            client.newCall(builder.build()).execute().use { response ->
                return Response(
                    response.code,
                    response.message,
                    response.headers.toMultimap(),
                    response.body?.string().orEmpty(),
                    response.request.url.toString(),
                )
            }
        }
    }
}
