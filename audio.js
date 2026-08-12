window.AudioEngine = (function() {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const state = {
        musicMuted: localStorage.getItem('musicMuted') === 'true',
        sfxMuted: localStorage.getItem('sfxMuted') === 'true'
    };

    const musicGain = audioCtx.createGain();
    musicGain.connect(audioCtx.destination);
    musicGain.gain.value = state.musicMuted ? 0 : 0.1;

    function updateMusicState() {
        musicGain.gain.setTargetAtTime(state.musicMuted ? 0 : 0.1, audioCtx.currentTime, 0.1);
    }

    let isMusicPlaying = false;

    return {
        state: state,
        
        toggleMusic: function() {
            state.musicMuted = !state.musicMuted;
            localStorage.setItem('musicMuted', state.musicMuted);
            updateMusicState();
            return state.musicMuted;
        },
        
        toggleSfx: function() {
            state.sfxMuted = !state.sfxMuted;
            localStorage.setItem('sfxMuted', state.sfxMuted);
            return state.sfxMuted;
        },
        
        init: function() {
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
        },
        
        playShoot: function() {
            if (state.sfxMuted) return;
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.type = 'square';
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            osc.frequency.setValueAtTime(800, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        },
        
        playExplosion: function() {
            if (state.sfxMuted) return;
            const bufferSize = audioCtx.sampleRate * 0.5;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const noiseSource = audioCtx.createBufferSource();
            noiseSource.buffer = buffer;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1000, audioCtx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.5);
            const gainNode = audioCtx.createGain();
            gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
            noiseSource.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            noiseSource.start();
        },
        
        playMusic: function() {
            if (isMusicPlaying) return;
            isMusicPlaying = true;
            const notes = [220, 261.63, 329.63, 392.00]; 
            let noteIndex = 0;
            setInterval(() => {
                if (state.musicMuted) return;
                const osc = audioCtx.createOscillator();
                osc.type = 'sawtooth';
                const noteGain = audioCtx.createGain();
                noteGain.gain.setValueAtTime(0, audioCtx.currentTime);
                noteGain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
                noteGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
                osc.frequency.setValueAtTime(notes[noteIndex], audioCtx.currentTime);
                const filter = audioCtx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(1000, audioCtx.currentTime);
                filter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
                osc.connect(filter);
                filter.connect(noteGain);
                noteGain.connect(musicGain);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.2);
                noteIndex = (noteIndex + 1) % notes.length;
            }, 200);
        }
    };
})();
