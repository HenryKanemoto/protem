import {DOCUMENT} from '@angular/common';
import {Injectable, inject} from '@angular/core';
import {ResultadoLeitura, planoDeRetorno} from '../lib/acessibilidade';
import {Acessibilidade} from './acessibilidade.service';

/**
 * Retorno do leitor de QR sem depender de olhar a tela: um som curto e uma vibração.
 * Tudo é gerado no aparelho (Web Audio e Vibration API), sem arquivo de áudio.
 * O aviso falado (leitor de tela) fica na própria tela do leitor, em uma região aria-live.
 * Respeita a preferência "Som e vibração ao ler QR" do painel de acessibilidade.
 */
@Injectable({providedIn: 'root'})
export class RetornoLeitor {
  private readonly acessibilidade = inject(Acessibilidade);
  private readonly documento = inject(DOCUMENT);
  private contexto: AudioContext | null = null;

  avisar(resultado: ResultadoLeitura) {
    if (!this.acessibilidade.preferencias().retornoDoLeitor) return;
    const plano = planoDeRetorno(resultado);
    this.tocar(plano.tons);
    try {
      this.documento.defaultView?.navigator.vibrate?.(plano.vibracao);
    } catch {
      // Sem vibração neste aparelho: o som e o aviso na tela bastam
    }
  }

  private tocar(tons: {frequencia: number; duracaoMs: number}[]) {
    try {
      const janela = this.documento.defaultView as (Window & typeof globalThis & {webkitAudioContext?: typeof AudioContext}) | null;
      const Contexto = janela?.AudioContext ?? janela?.webkitAudioContext;
      if (!Contexto) return;
      const audio = (this.contexto ??= new Contexto());
      if (audio.state === 'suspended') void audio.resume();

      let inicio = audio.currentTime;
      for (const tom of tons) {
        const duracao = tom.duracaoMs / 1000;
        const oscilador = audio.createOscillator();
        const volume = audio.createGain();
        oscilador.type = 'sine';
        oscilador.frequency.value = tom.frequencia;
        // Sobe e desce rápido para não estalar no começo e no fim do tom
        volume.gain.setValueAtTime(0.0001, inicio);
        volume.gain.exponentialRampToValueAtTime(0.18, inicio + 0.015);
        volume.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao);
        oscilador.connect(volume).connect(audio.destination);
        oscilador.start(inicio);
        oscilador.stop(inicio + duracao + 0.02);
        inicio += duracao + 0.04;
      }
    } catch {
      // Navegador sem áudio, ou bloqueado até o primeiro toque: segue sem som
    }
  }
}
