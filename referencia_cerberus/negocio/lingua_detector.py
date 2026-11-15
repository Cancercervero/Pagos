"""
LINGUA DETECTOR — Detección de idioma ultrarrápida (V1.0)
=========================================================
Sin dependencias externas pesadas.
Fase 1: Fingerprint por caracteres Unicode (instantáneo, cubre 95% de casos)
Fase 2: N-grams de las palabras más frecuentes por idioma
Fase 3: Fallback a think_lite si las fases 1-2 no son concluyentes

Idiomas soportados:
  es (español), en (inglés), pt (portugués), fr (francés),
  de (alemán), it (italiano), ru (ruso), ja (japonés), zh (chino),
  ar (árabe), ko (coreano)

API:
    from cerberus_core.lingua_detector import detect_language, get_greeting
    lang = detect_language("Hello how are you")  # → "en"
    lang = detect_language("Hola cómo estás")     # → "es"
    greeting = get_greeting("en", "Ana")           # → "Hi Ana! How can I help you?"
"""
import re

# ── FASE 1: Fingerprints Unicode (idiomas con scripts propios) ───────────────
_UNICODE_RANGES = [
    ("ja", r'[\u3040-\u30FF\u31F0-\u31FF]'),   # Hiragana, Katakana
    ("zh", r'[\u4E00-\u9FFF\u3400-\u4DBF]'),   # CJK
    ("ko", r'[\uAC00-\uD7AF\u1100-\u11FF]'),   # Hangul
    ("ar", r'[\u0600-\u06FF]'),                 # Árabe
    ("ru", r'[\u0400-\u04FF]'),                 # Cirílico
]

# ── FASE 2: Palabras de alta frecuencia por idioma ───────────────────────────
_STOPWORDS = {
    "es": {"hola","qué","que","cómo","como","quiero","quisiera","necesito","tengo","hay","gracias",
           "por","favor","me","mi","tu","sus","una","uno","los","las","del","con","para","pero","ya",
           "mas","más","donde","cuando","precio","cuanto","cuánto","puedo","puede","tienes","tienen"},
    "en": {"hello","hi","what","how","want","need","have","there","thanks","thank","you","your","my",
           "the","and","for","with","but","already","where","when","price","much","can","do","does","is"},
    "pt": {"olá","ola","como","quero","preciso","tenho","tem","obrigado","por","favor","meu","minha",
           "uma","para","com","mas","onde","quando","preço","quanto","posso","pode","você","seu"},
    "fr": {"bonjour","salut","comment","veux","besoin","merci","pour","avec","mais","où","quand",
           "prix","combien","puis","pouvez","votre","mon","une","les","des"},
    "de": {"hallo","wie","will","brauche","habe","gibt","danke","bitte","für","mit","aber","wo",
           "wann","preis","wie viel","kann","können","ihr","mein","eine","die","der","das"},
    "it": {"ciao","salve","come","voglio","bisogno","grazie","per","con","ma","dove","quando",
           "prezzo","quanto","posso","può","suo","mio","una","le","del"},
}

_LANG_NAMES = {
    "es": "Spanish", "en": "English", "pt": "Portuguese", "fr": "French",
    "de": "German", "it": "Italian", "ru": "Russian", "ja": "Japanese",
    "zh": "Chinese", "ar": "Arabic", "ko": "Korean",
}

# ── SALUDOS Y FRASES CLAVE POR IDIOMA ────────────────────────────────────────
_ANNIE_RESPONSES = {
    "es": {
        "greeting":  "¡Hola{name}! Soy Annie, tu asistente. ¿En qué te puedo ayudar hoy?",
        "quote_ack": "¡Claro{name}! Dame un momento para preparar tu cotización.",
        "appt_ack":  "Con gusto{name}. Déjame revisar la agenda y te propongo un horario.",
        "fallback":  "Entendido{name}, déjame ver qué puedo hacer por ti.",
        "no_answer": "Déjame verificar eso con el equipo y te respondo en breve{name}.",
    },
    "en": {
        "greeting":  "Hi{name}! I'm Annie, your assistant. How can I help you today?",
        "quote_ack": "Sure{name}! Give me a moment to prepare your quote.",
        "appt_ack":  "Of course{name}. Let me check the schedule and suggest a time for you.",
        "fallback":  "Got it{name}, let me see what I can do for you.",
        "no_answer": "Let me check that with the team and get back to you{name}.",
    },
    "pt": {
        "greeting":  "Olá{name}! Sou Annie, sua assistente. Como posso ajudá-lo hoje?",
        "quote_ack": "Claro{name}! Deixa eu preparar seu orçamento.",
        "appt_ack":  "Com prazer{name}. Vou verificar a agenda e te propor um horário.",
        "fallback":  "Entendido{name}, deixa eu ver o que posso fazer por você.",
        "no_answer": "Deixa eu verificar isso com a equipe e te respondo em breve{name}.",
    },
    "fr": {
        "greeting":  "Bonjour{name}! Je suis Annie, votre assistante. Comment puis-je vous aider?",
        "quote_ack": "Bien sûr{name}! Laissez-moi préparer votre devis.",
        "appt_ack":  "Avec plaisir{name}. Je vais vérifier l'agenda et vous proposer un créneau.",
        "fallback":  "Compris{name}, laissez-moi voir ce que je peux faire pour vous.",
        "no_answer": "Je vais vérifier ça avec l'équipe et vous répondre bientôt{name}.",
    },
    "de": {
        "greeting":  "Hallo{name}! Ich bin Annie, Ihre Assistentin. Wie kann ich Ihnen helfen?",
        "quote_ack": "Natürlich{name}! Einen Moment, ich erstelle Ihr Angebot.",
        "appt_ack":  "Gerne{name}. Ich schaue in den Kalender und schlage Ihnen einen Termin vor.",
        "fallback":  "Verstanden{name}, ich schaue, was ich für Sie tun kann.",
        "no_answer": "Ich werde das mit dem Team klären und mich bald bei Ihnen melden{name}.",
    },
    "it": {
        "greeting":  "Ciao{name}! Sono Annie, la tua assistente. Come posso aiutarti oggi?",
        "quote_ack": "Certo{name}! Dammi un momento per preparare il tuo preventivo.",
        "appt_ack":  "Con piacere{name}. Controllo l'agenda e ti propongo un orario.",
        "fallback":  "Capito{name}, vediamo cosa posso fare per te.",
        "no_answer": "Verifico con il team e ti rispondo presto{name}.",
    },
}
# Idiomas sin tabla predefinida → caen al inglés
_ANNIE_RESPONSES["ru"] = _ANNIE_RESPONSES["en"]
_ANNIE_RESPONSES["ja"] = _ANNIE_RESPONSES["en"]
_ANNIE_RESPONSES["zh"] = _ANNIE_RESPONSES["en"]
_ANNIE_RESPONSES["ar"] = _ANNIE_RESPONSES["en"]
_ANNIE_RESPONSES["ko"] = _ANNIE_RESPONSES["en"]


def detect_language(text: str, fallback_llm=None) -> str:
    """
    Detecta el idioma del texto.
    fallback_llm: función callable(prompt) → str, p.ej. gate.think_lite
    Retorna código ISO 639-1 de 2 letras. Default: 'es'.
    """
    if not text or len(text.strip()) < 3:
        return "es"

    text_clean = text.strip().lower()

    # Fase 1: Scripts Unicode propios (sin ambigüedad)
    for lang, pattern in _UNICODE_RANGES:
        if re.search(pattern, text):
            return lang

    # Fase 2: Conteo de stopwords por idioma
    words = set(re.findall(r"\b\w+\b", text_clean))
    scores = {}
    for lang, stopwords in _STOPWORDS.items():
        score = len(words & stopwords)
        if score > 0:
            scores[lang] = score

    if scores:
        best = max(scores, key=scores.get)
        # Solo aceptar si hay diferencia clara con el segundo lugar
        sorted_scores = sorted(scores.values(), reverse=True)
        if len(sorted_scores) == 1 or sorted_scores[0] > sorted_scores[1]:
            return best

    # Fase 3: Fallback a LLM (solo si se provee)
    if fallback_llm:
        try:
            prompt = (
                f"Detect the language of this text. Reply with ONLY the ISO 639-1 code (2 letters, lowercase). "
                f"Examples: es, en, pt, fr, de, it, ru, ja, zh, ar, ko\n"
                f"Text: '{text[:200]}'\nCode:"
            )
            result = fallback_llm(prompt).strip().lower()[:2]
            if result in _STOPWORDS or result in ("ja", "zh", "ar", "ru", "ko"):
                return result
        except Exception:
            pass

    # Default: español (mercado principal)
    return "es"


def get_annie_phrase(lang: str, phrase_key: str, name: str = "") -> str:
    """
    Devuelve una frase de Annie en el idioma detectado.
    phrase_key: greeting | quote_ack | appt_ack | fallback | no_answer
    name: nombre del cliente (opcional, se inserta naturalmente)
    """
    name_part = f", {name}" if name else ""
    lang_responses = _ANNIE_RESPONSES.get(lang, _ANNIE_RESPONSES["en"])
    template = lang_responses.get(phrase_key, lang_responses["fallback"])
    return template.format(name=name_part)


def get_sys_prompt_language_note(lang: str) -> str:
    """
    Instrucción para el LLM: responder en el idioma del cliente.
    Se inyecta en el system prompt de Annie.
    """
    if lang == "es":
        return ""  # Default, no necesita nota extra
    lang_name = _LANG_NAMES.get(lang, "English")
    return (
        f"\n⚠️ IMPORTANT: The client is writing in {lang_name}. "
        f"You MUST respond ENTIRELY in {lang_name}. "
        f"Do not switch to Spanish under any circumstances."
    )
