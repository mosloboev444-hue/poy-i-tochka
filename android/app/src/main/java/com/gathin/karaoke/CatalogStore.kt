package com.gathin.karaoke

import android.content.Context
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.zip.ZipInputStream

/**
 * Local karaoke packs.
 *
 * A pack is a ZIP with catalog.json at the root (or one folder deep):
 * {
 *   "name": "Мой пакет",
 *   "tracks": [
 *     {"title": "...", "artist": "...", "genre": "...", "audio": "audio/song.mp3",
 *      "lyrics": "lyrics/song.lrc", "duration": 218}
 *   ]
 * }
 */
object CatalogStore {
    private fun root(context: Context): File = File(context.filesDir, "catalog").apply { mkdirs() }

    fun importZip(context: Context, uri: Uri): String? {
        val temp = File(context.cacheDir, "catalog-import-${System.currentTimeMillis()}").apply { mkdirs() }
        return try {
            context.contentResolver.openInputStream(uri)?.use { input ->
                ZipInputStream(input).use { zip ->
                    var entry = zip.nextEntry
                    while (entry != null) {
                        val name = entry.name.replace('\\', '/')
                        if (!entry.isDirectory && name.isNotBlank() && !name.startsWith("/") && !name.contains("..")) {
                            val target = File(temp, name)
                            if (!target.canonicalPath.startsWith(temp.canonicalPath + File.separator)) {
                                return null
                            }
                            target.parentFile?.mkdirs()
                            target.outputStream().use { output -> zip.copyTo(output) }
                        }
                        zip.closeEntry()
                        entry = zip.nextEntry
                    }
                }
            } ?: return null

            val manifest = findManifest(temp) ?: return null
            val json = JSONObject(manifest.readText())
            val tracks = json.optJSONArray("tracks") ?: return null
            if (tracks.length() == 0) return null

            val packId = "pack_" + System.currentTimeMillis()
            val target = File(root(context), packId)
            val sourceDir = manifest.parentFile ?: temp
            sourceDir.copyRecursively(target, overwrite = true)
            target.mkdirs()
            manifest.copyTo(File(target, "catalog.json"), overwrite = true)
            packId
        } catch (exc: Exception) {
            null
        } finally {
            temp.deleteRecursively()
        }
    }

    private fun findManifest(dir: File): File? {
        val direct = File(dir, "catalog.json")
        if (direct.isFile) return direct
        val children = dir.listFiles()?.filter { it.isDirectory } ?: return null
        for (child in children) {
            val nested = File(child, "catalog.json")
            if (nested.isFile) return nested
        }
        return null
    }

    fun importZipFile(context: Context, file: File): String? =
        importZip(context, Uri.fromFile(file))

    fun deletePack(context: Context, packId: String): Boolean {
        if (packId.isBlank() || packId.contains('/') || packId.contains("..")) return false
        val pack = File(root(context), packId)
        if (!pack.isDirectory || !pack.canonicalPath.startsWith(root(context).canonicalPath + File.separator)) return false
        return pack.deleteRecursively()
    }

    fun tracks(context: Context): JSONArray {
        val result = JSONArray()
        val packs = root(context).listFiles()?.filter { it.isDirectory } ?: return result
        for (pack in packs.sortedBy { it.name }) {
            val manifest = File(pack, "catalog.json").takeIf { it.isFile } ?: continue
            val json = runCatching { JSONObject(manifest.readText()) }.getOrNull() ?: continue
            val packName = json.optString("name", "Локальный пакет")
            val items = json.optJSONArray("tracks") ?: continue
            for (index in 0 until items.length()) {
                val item = items.optJSONObject(index) ?: continue
                val title = item.optString("title").trim()
                val artist = item.optString("artist").trim()
                val audioPath = item.optString("audio").trim()
                if (title.isBlank() || artist.isBlank() || audioPath.isBlank()) continue
                val audio = File(pack, audioPath)
                if (!audio.isFile || !audio.canonicalPath.startsWith(pack.canonicalPath + File.separator)) continue
                val lyricsPath = item.optString("lyrics").trim()
                val lyrics = if (lyricsPath.isNotBlank()) File(pack, lyricsPath) else null
                val hasLyrics = lyrics?.isFile == true &&
                    lyrics.canonicalPath.startsWith(pack.canonicalPath + File.separator)
                result.put(
                    JSONObject()
                        .put("id", "pack:${pack.name}:$index")
                        .put("pack_id", pack.name)
                        .put("source", "local")
                        .put("title", title)
                        .put("raw_title", title)
                        .put("artist", artist)
                        .put("duration", item.optDouble("duration", 0.0))
                        .put("thumbnail", item.optString("thumbnail").ifBlank { JSONObject.NULL })
                        .put("stream_url", mediaUrl(pack.name, audioPath))
                        .put("instrumental_url", JSONObject.NULL)
                        .put("embed_url", JSONObject.NULL)
                        .put("webpage_url", JSONObject.NULL)
                        .put("is_karaoke", true)
                        .put("is_instrumental", true)
                        .put("is_pack", true)
                        .put("has_lyrics", hasLyrics)
                        .put("has_synced_lyrics", hasLyrics)
                        .put("lyrics_url", if (hasLyrics) lyricsUrl(pack.name, lyricsPath) else JSONObject.NULL)
                        .put("provider", packName)
                        .put("license", "Local pack")
                        .put("album", packName)
                )
            }
        }
        return result
    }

    fun lyrics(context: Context, packName: String, filePath: String): String? {
        val pack = File(root(context), packName)
        val file = File(pack, filePath)
        if (!file.isFile || !file.canonicalPath.startsWith(pack.canonicalPath + File.separator)) return null
        return runCatching { file.readText().removePrefix("\uFEFF") }.getOrNull()
    }

    private fun mediaUrl(pack: String, path: String): String =
        "/media/catalog/${encodeSegment(pack)}/${path.split('/').joinToString("/") { encodeSegment(it) }}"

    private fun lyricsUrl(pack: String, path: String): String =
        "/api/local/lyrics?pack=${encodeSegment(pack)}&file=${encodeSegment(path)}"

    private fun encodeSegment(value: String): String = Uri.encode(value).replace("+", "%20")
}
