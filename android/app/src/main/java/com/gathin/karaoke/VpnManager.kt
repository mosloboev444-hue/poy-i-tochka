package com.gathin.karaoke

import android.content.Context
import org.amnezia.awg.backend.GoBackend
import org.amnezia.awg.backend.Tunnel
import org.amnezia.awg.backend.TunnelActionHandler
import org.amnezia.awg.config.Config
import java.io.ByteArrayInputStream
import java.io.File

object VpnManager {
    @Volatile
    var state: Tunnel.State = Tunnel.State.DOWN
        private set

    private var backend: GoBackend? = null
    private var tunnel: KaraokeTunnel? = null

    val isUp: Boolean
        get() = state == Tunnel.State.UP

    @Synchronized
    fun connect(context: Context, configFile: File) {
        if (isUp) return
        disconnect()

        val raw = configFile.readText(Charsets.UTF_8)
        val prepared = ConfigStore.withLanBypass(raw)
        val config = Config.parse(ByteArrayInputStream(prepared.toByteArray(Charsets.UTF_8)))
        val newTunnel = KaraokeTunnel("karaoke") { newState -> state = newState }
        val newBackend = GoBackend(context.applicationContext, NoopActionHandler)
        val result = newBackend.setState(newTunnel, Tunnel.State.UP, config)
        state = result
        backend = newBackend
        tunnel = newTunnel
    }

    @Synchronized
    fun disconnect() {
        val currentBackend = backend ?: return
        val currentTunnel = tunnel ?: return
        runCatching { currentBackend.setState(currentTunnel, Tunnel.State.DOWN, null) }
        state = Tunnel.State.DOWN
        backend = null
        tunnel = null
    }

    private class KaraokeTunnel(
        private val name: String,
        private val onState: (Tunnel.State) -> Unit
    ) : Tunnel {
        override fun getName(): String = name
        override fun onStateChange(newState: Tunnel.State) = onState(newState)
        override fun isIpv4ResolutionPreferred(): Boolean = true
        override fun isMetered(): Boolean = false
    }

    private object NoopActionHandler : TunnelActionHandler {
        override fun runPreUp(scripts: MutableCollection<String>?) = Unit
        override fun runPostUp(scripts: MutableCollection<String>?) = Unit
        override fun runPreDown(scripts: MutableCollection<String>?) = Unit
        override fun runPostDown(scripts: MutableCollection<String>?) = Unit
    }
}
