import { Howl } from "howler";




export const CreateAudio = () => {
    const howl = new Howl({
        src:["/audio/typing-hard.mp3","/audio/typing-sweet.mp3"],
        html5:true,
        loop:true,
        autoplay:true
    })


    return howl;
}