import pyttsx3

def text_to_speech(text, voice_id=None):
    engine = pyttsx3.init()
    if voice_id:
        engine.setProperty('voice', voice_id)
    engine.setProperty('rate', 150)  # Ovoz tezligi
    engine.say(text)
    engine.runAndWait()
