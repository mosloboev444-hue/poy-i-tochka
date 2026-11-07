package com.gathin.karaoke

import android.content.Context
import android.net.Uri
import java.io.File

object ConfigStore {
    /**
     * All IPv4 space except LAN, loopback, link-local and multicast. This keeps the karaoke
     * backend on the local network reachable while everything else goes through AmneziaWG.
     */
    private const val LAN_BYPASS =
        "0.0.0.0/5, 8.0.0.0/7, 11.0.0.0/8, 12.0.0.0/6, 16.0.0.0/4, 32.0.0.0/3, 64.0.0.0/3, " +
            "96.0.0.0/4, 112.0.0.0/5, 120.0.0.0/6, 124.0.0.0/7, 126.0.0.0/8, 128.0.0.0/3, " +
            "160.0.0.0/5, 168.0.0.0/8, 169.0.0.0/9, 169.128.0.0/10, 169.192.0.0/11, " +
            "169.224.0.0/12, 169.240.0.0/13, 169.248.0.0/14, 169.252.0.0/15, 169.255.0.0/16, " +
            "170.0.0.0/7, 172.0.0.0/12, 172.32.0.0/11, 172.64.0.0/10, 172.128.0.0/9, " +
            "173.0.0.0/8, 174.0.0.0/7, 176.0.0.0/4, 192.0.0.0/9, 192.128.0.0/11, " +
            "192.160.0.0/13, 192.169.0.0/16, 192.170.0.0/15, 192.172.0.0/14, 192.176.0.0/12, " +
            "192.192.0.0/10, 193.0.0.0/8, 194.0.0.0/7, 196.0.0.0/6, 200.0.0.0/5, " +
            "208.0.0.0/4, 240.0.0.0/4"

    private val allowedIpsLine = Regex("(?m)^\\s*AllowedIPs\\s*=.*$")

    fun configsDir(context: Context): File =
        File(context.filesDir, "configs").apply { mkdirs() }

    fun ensureBundled(context: Context) {
        val assets = context.assets.list("vpn") ?: return
        val dir = configsDir(context)
        for (name in assets) {
            if (!name.endsWith(".conf", ignoreCase = true)) continue
            val target = File(dir, name)
            if (target.exists()) continue
            runCatching {
                context.assets.open("vpn/$name").use { input ->
                    target.outputStream().use { output -> input.copyTo(output) }
                }
            }
        }
    }

    fun list(context: Context): List<File> =
        configsDir(context).listFiles { file -> file.isFile && file.name.endsWith(".conf") }
            ?.sortedBy { it.name.lowercase() }
            ?: emptyList()

    fun import(context: Context, uri: Uri): File? {
        val nameFromProvider = context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val index = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
            if (index >= 0 && cursor.moveToFirst()) cursor.getString(index) else null
        }
        val safeName = (nameFromProvider ?: "imported.conf")
            .substringAfterLast('/')
            .replace(Regex("[^A-Za-z0-9._-]"), "_")
            .let { if (it.endsWith(".conf", ignoreCase = true)) it else "$it.conf" }
        val target = File(configsDir(context), safeName)
        return runCatching {
            context.contentResolver.openInputStream(uri)?.use { input ->
                target.outputStream().use { output -> input.copyTo(output) }
            }
            target.takeIf { it.exists() && it.length() > 0 }
        }.getOrNull()
    }

    fun withLanBypass(raw: String): String {
        if (!allowedIpsLine.containsMatchIn(raw)) return raw
        return allowedIpsLine.replace(raw, "AllowedIPs = $LAN_BYPASS, ::/0")
    }
}
