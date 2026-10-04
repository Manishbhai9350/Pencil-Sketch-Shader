import { Howl } from "howler";

export const CreateAudio = () => {
  const rate = 1.3;

  const sweetTrack = new Howl({
    src: ["/audio/typing-sweet.mp3"],
    html5: false, // Web Audio API sub-millisecond precision sync ke liye better hai
    loop: true,
    rate: rate,
    volume: 0.5,
  });

  const hardTrack = new Howl({
    src: ["/audio/typing-hard.mp3"],
    html5: false,
    loop: true,
    rate: rate,
    autoplay:true,
    volume: 0.3,
  });

  return {
    sweetTrack,
    hardTrack,
    
    // Both tracks sync play
    play: () => {
      if (!sweetTrack.playing()) sweetTrack.play();
      if (!hardTrack.playing()) hardTrack.play();
    },

    // Both tracks pause
    pause: () => {
      sweetTrack.pause();
      hardTrack.pause();
    },

    // Optional: Playback speed dynamically adjust karne ke liye
    setRate: (newRate) => {
      sweetTrack.rate(newRate);
      hardTrack.rate(newRate);
    },

    // Optional: Individual volumes tweak karne ke liye
    setVolumes: (sweetVol, hardVol) => {
      sweetTrack.volume(sweetVol);
      hardTrack.volume(hardVol);
    }
  };
};