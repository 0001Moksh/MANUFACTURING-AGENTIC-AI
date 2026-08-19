def is_actual_interruption(text: str) -> bool:
    """
    Determines if the transcribed user speech during AI playback
    is an actual interruption or just a backchannel.
    
    Backchannels: "uh-huh", "yeah", "hmm", "okay"
    Interruptions: "stop", "wait", "no", "hold on", etc.
    """
    text = text.lower().strip()
    
    # Remove punctuation
    import string
    text = text.translate(str.maketrans('', '', string.punctuation))
    
    backchannels = {"uhhuh", "yeah", "hmm", "okay", "ok", "ah", "i see", "right", "mhm", "yep"}
    
    # If the entire utterance is just a backchannel, ignore it.
    if text in backchannels:
        return False
        
    # If it's very short and generic, it might be a backchannel
    if len(text.split()) == 1 and text in {"yes", "sure"}:
        return False
        
    return True

