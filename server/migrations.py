"""Schema migration runner. Called on app startup; idempotent."""

import sqlite3

SCHEMA = [
    """
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        plan TEXT NOT NULL DEFAULT 'free',
        created_at TEXT NOT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS practice_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        session_type TEXT NOT NULL DEFAULT 'free_practice',
        original_text TEXT,
        corrected_text TEXT,
        metrics_json TEXT,
        language_alert TEXT,
        grammar_errors_json TEXT,
        vocabulary_suggestions_json TEXT,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_id
        ON practice_sessions(user_id);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_practice_sessions_started_at
        ON practice_sessions(started_at);
    """,
    """
    CREATE TABLE IF NOT EXISTS vocabulary_words (
        id TEXT PRIMARY KEY,
        word TEXT UNIQUE NOT NULL,
        phonetic TEXT,
        meaning TEXT,
        synonyms_json TEXT,
        antonyms_json TEXT,
        examples_json TEXT
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS user_vocabulary_bookmarks (
        user_id TEXT,
        word_id TEXT,
        PRIMARY KEY (user_id, word_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (word_id) REFERENCES vocabulary_words(id) ON DELETE CASCADE
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS partner_messages (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS user_settings (
        user_id TEXT PRIMARY KEY,
        language TEXT NOT NULL DEFAULT 'en-US',
        notifications_json TEXT NOT NULL DEFAULT '{"practiceReminders":true,"weeklyReport":true,"achievements":true,"sound":true}',
        english_only_mode INTEGER DEFAULT 1,
        selected_voice TEXT DEFAULT 'aria',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS daily_challenges (
        id TEXT PRIMARY KEY,
        challenge_date TEXT UNIQUE NOT NULL,
        challenge_type TEXT NOT NULL,
        title TEXT NOT NULL,
        prompt TEXT NOT NULL,
        image_url TEXT,
        reward TEXT
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS user_challenge_completions (
        user_id TEXT NOT NULL,
        challenge_id TEXT NOT NULL,
        score INTEGER NOT NULL,
        completed_at TEXT NOT NULL,
        PRIMARY KEY (user_id, challenge_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (challenge_id) REFERENCES daily_challenges(id) ON DELETE CASCADE
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS mock_interviews (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        company TEXT NOT NULL,
        role TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        started_at TEXT NOT NULL,
        total_score INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS mock_interview_questions (
        id TEXT PRIMARY KEY,
        interview_id TEXT NOT NULL,
        question TEXT NOT NULL,
        category TEXT NOT NULL,
        user_transcript TEXT,
        grammar_score INTEGER,
        clarity_score INTEGER,
        confidence_score INTEGER,
        feedback TEXT,
        FOREIGN KEY (interview_id) REFERENCES mock_interviews(id) ON DELETE CASCADE
    );
    """,
]


def run_migrations(conn: sqlite3.Connection) -> None:
    for stmt in SCHEMA:
        conn.execute(stmt)

    # Pre-populate vocabulary words
    import json
    vocab = [
        ("v1", "Eloquent", "/ˈeləkwənt/", "Fluent and persuasive in speaking or writing.", ["articulate", "expressive"], ["inarticulate"], ["She gave an eloquent speech that moved the room."]),
        ("v2", "Resilient", "/rɪˈzɪliənt/", "Able to recover quickly from difficulties.", ["tough", "robust"], ["fragile"], ["Children are remarkably resilient to changes."]),
        ("v3", "Meticulous", "/məˈtɪkyələs/", "Showing great attention to detail; very careful and precise.", ["thorough", "precise"], ["careless"], ["He is meticulous about keeping his files organized."]),
        ("v4", "Pragmatic", "/præɡˈmæt.ɪk/", "Dealing with things sensibly and realistically in a way that is based on practical rather than theoretical considerations.", ["practical", "sensible"], ["idealistic"], ["We need a pragmatic approach to solve this issue."]),
        ("v5", "Ephemeral", "/ɪˈfem.ər.əl/", "Lasting for a very short time.", ["transient", "fleeting"], ["permanent"], ["Fame in the internet age can be rather ephemeral."]),
        ("v6", "Ubiquitous", "/juːˈbɪk.wɪ.təs/", "Present, appearing, or found everywhere.", ["omnipresent", "pervasive"], ["rare"], ["Mobile phones are now ubiquitous in modern society."]),
        ("v7", "Equivocal", "/ɪˈkwɪv.ə.kəl/", "Vague or ambiguous; open to more than one interpretation.", ["ambiguous", "uncertain"], ["clear", "unequivocal"], ["His response was equivocal, leaving us with more questions."]),
        ("v8", "Assiduous", "/əˈsɪd.ju.əs/", "Showing great care and perseverance.", ["diligent", "industrious"], ["lazy", "negligent"], ["She was assiduous in her prep for the job interview."]),
        ("v9", "Capricious", "/kəˈprɪʃ.əs/", "Given to sudden and unaccountable changes of mood or behavior.", ["fickle", "inconstant"], ["stable", "consistent"], ["The administration's policies are capricious and change weekly."]),
        ("v10", "Loquacious", "/ləʊˈkweɪ.ʃəs/", "Tending to talk a great deal; talkative.", ["talkative", "garrulous"], ["silent", "reticent"], ["Usually reticent, he became loquacious after a few drinks."]),
        ("v11", "Audacious", "/ɔːˈdeɪ.ʃəs/", "Showing a willingness to take surprisingly bold risks.", ["bold", "daring"], ["timid", "cautious"], ["It was an audacious decision to launch the product so early."]),
        ("v12", "Superfluous", "/suːˈpɜː.flu.əs/", "Unnecessary, especially through being more than enough.", ["redundant", "excessive"], ["necessary", "essential"], ["The designer cut out all superfluous details from the report."]),
        ("v13", "Tenable", "/ˈten.ə.bəl/", "Able to be maintained or defended against attack or objection.", ["defensible", "arguable"], ["untenable", "indefensible"], ["His position is no longer tenable in light of the new evidence."]),
        ("v14", "Aesthetic", "/iːsˈθet.ɪk/", "Concerned with beauty or the appreciation of beauty.", ["artistic", "beautiful"], ["unattractive", "plain"], ["The building has a clean, minimalist aesthetic."]),
        ("v15", "Mitigate", "/ˈmɪt.ɪ.ɡeɪt/", "Make less severe, serious, or painful.", ["alleviate", "reduce"], ["aggravate", "intensify"], ["We need to mitigate the risks associated with the migration."]),
        ("v16", "Cacophony", "/kəˈkɒf.ə.ni/", "A harsh, discordant mixture of sounds.", ["din", "racket"], ["harmony", "euphony"], ["The city streets were filled with a cacophony of car horns."]),
        ("v17", "Alacrity", "/əˈlæk.rə.ti/", "Brisk and cheerful readiness.", ["eagerness", "readiness"], ["apathy", "reluctance"], ["She accepted the job offer with alacrity."]),
        ("v18", "Pensive", "/ˈpen.sɪv/", "Engaged in, involving, or reflecting deep or serious thought.", ["thoughtful", "reflective"], ["shallow", "carefree"], ["He sat by the window in a pensive mood."]),
        ("v19", "Cognizant", "/ˈkɒɡ.nɪ.zənt/", "Having knowledge or being aware of.", ["aware", "conscious"], ["ignorant", "unaware"], ["We must be cognizant of the local regulations."]),
        ("v20", "Anomalous", "/əˈnɒm.ə.ləs/", "Deviating from what is standard, normal, or expected.", ["abnormal", "peculiar"], ["normal", "typical"], ["The system detected an anomalous spike in traffic."]),
        ("v21", "Gregarious", "/ɡrɪˈɡeə.ri.əs/", "Fond of company; sociable.", ["sociable", "outgoing"], ["unsociable", "introverted"], ["She is a gregarious person who loves attending social events."]),
        ("v22", "Transient", "/ˈtræn.zi.ənt/", "Lasting only for a short time; impermanent.", ["temporary", "fleeting"], ["permanent", "lasting"], ["The storm caused a transient power outage."]),
        ("v23", "Venerate", "/ˈven.ər.eɪt/", "Regard with great respect; revere.", ["respect", "revere"], ["despise", "dishonor"], ["Many cultures venerate their elders for their wisdom."]),
        ("v24", "Laconic", "/ləˈkɒn.ɪk/", "Using very few words.", ["concise", "brief"], ["verbose", "talkative"], ["His laconic reply suggested he was not interested in chatting."]),
        ("v25", "Obfuscate", "/ˈɒb.fʌs.keɪt/", "Render unclear or unintelligible.", ["confuse", "muddy"], ["clarify", "explain"], ["Do not try to obfuscate the truth with technical jargon."]),
        ("v26", "Benevolent", "/bəˈnev.əl.ənt/", "Well meaning and kindly.", ["kind", "charitable"], ["malevolent", "spiteful"], ["The benevolent donor funded the school library."]),
        ("v27", "Candid", "/ˈkæn.dɪd/", "Truthful and straightforward; frank.", ["frank", "honest"], ["deceitful", "evasive"], ["Thank you for your candid feedback on the presentation."]),
        ("v28", "Devoid", "/dɪˈvɔɪd/", "Entirely lacking or free from.", ["lacking", "empty"], ["full", "abundant"], ["The arguments were devoid of any solid evidence."]),
        ("v29", "Fastidious", "/fæsˈtɪd.i.əs/", "Very attentive to and concerned about accuracy and detail.", ["scrupulous", "meticulous"], ["careless", "sloppy"], ["She is fastidious about maintaining clean source code."]),
        ("v30", "Inherent", "/ɪnˈhɪə.rənt/", "Existing in something as a permanent, essential, or characteristic attribute.", ["intrinsic", "essential"], ["extrinsic", "acquired"], ["There are inherent risks in any business venture."]),
        ("v31", "Rancor", "/ˈræŋ.kər/", "Bitterness or resentfulness, especially when long-standing.", ["bitterness", "resentment"], ["friendliness", "goodwill"], ["They parted ways without any rancor or hard feelings."]),
        ("v32", "Scrutinize", "/ˈskruː.tɪ.naɪz/", "Examine or inspect closely and thoroughly.", ["examine", "inspect"], ["ignore", "glance"], ["The auditors will scrutinize every financial transaction."]),
        ("v33", "Tacit", "/ˈtæs.ɪt/", "Understood or implied without being directly stated.", ["implied", "implicit"], ["explicit", "stated"], ["Their silence was taken as a tacit agreement to the deal."]),
        ("v34", "Zeal", "/ziːl/", "Great energy or enthusiasm in pursuit of a cause or an objective.", ["enthusiasm", "passion"], ["indifference", "apathy"], ["She worked with great zeal to complete the project on time."]),
        ("v35", "Adversity", "/ədˈvɜː.sə.ti/", "A state of misfortune or difficulty.", ["misfortune", "hardship"], ["prosperity", "good fortune"], ["She overcame adversity to build a successful career."]),
        ("v36", "Altruistic", "/ˌæl.truˈɪs.tɪk/", "Showing a disinterested and selfless concern for the well-being of others.", ["unselfish", "charitable"], ["selfish", "greedy"], ["His altruistic nature led him to volunteer at the hospital."]),
        ("v37", "Coalesce", "/ˌkəʊ.əˈles/", "Come together to form one mass or whole.", ["merge", "unite"], ["split", "separate"], ["The different ideas began to coalesce into a coherent plan."]),
        ("v38", "Deference", "/ˈdef.ər.əns/", "Polite submission and respect.", ["respect", "reverence"], ["disrespect", "contempt"], ["He bowed his head in deference to the judge."]),
        ("v39", "Empathy", "/ˈem.pə.θi/", "The ability to understand and share the feelings of another.", ["compassion", "understanding"], ["apathy", "indifference"], ["Showing empathy towards colleagues builds a healthy team."]),
        ("v40", "Frugal", "/ˈfruː.ɡəl/", "Sparing or economical with regard to money or food.", ["thrifty", "economical"], ["extravagant", "wasteful"], ["They led a frugal life, saving every penny they could."]),
        ("v41", "Innovate", "/ˈɪn.ə.veɪt/", "Make changes in something established, especially by introducing new methods, ideas, or products.", ["invent", "introduce"], ["copy", "imitate"], ["Companies must innovate constantly to remain competitive."]),
        ("v42", "Jovial", "/ˈdʒəʊ.vi.əl/", "Cheerful and friendly.", ["cheerful", "jolly"], ["gloomy", "morose"], ["She was in a jovial mood after receiving the promotion."]),
        ("v43", "Kudos", "/ˈkjuː.dɒs/", "Praise and honor received for an achievement.", ["praise", "glory"], ["criticism", "blame"], ["Kudos to the team for delivering the product on time."]),
        ("v44", "Lucid", "/ˈluː.sɪd/", "Expressed clearly; easy to understand.", ["clear", "coherent"], ["confusing", "vague"], ["The professor gave a lucid explanation of a complex theory."]),
        ("v45", "Novel", "/ˈnɒv.əl/", "New or unusual in an interesting way.", ["new", "innovative"], ["old", "traditional"], ["He proposed a novel solution to the traffic congestion."]),
        ("v46", "Optimum", "/ˈɒp.tɪ.məm/", "Most conducive to a favorable outcome; best.", ["optimal", "best"], ["worst", "poor"], ["We need to find the optimum temperature for the reaction."]),
        ("v47", "Pinnacle", "/ˈpɪn.ə.kəl/", "The most successful point; the culmination.", ["peak", "height"], ["bottom", "nadir"], ["Reaching the pinnacle of his career took years of effort."]),
        ("v48", "Quell", "/kwel/", "Put an end to (a disorder or rebellion), typically by force.", ["suppress", "extinguish"], ["ignite", "foment"], ["The government deployed extra troops to quell the riots."]),
        ("v49", "Reverent", "/ˈrev.ər.ənt/", "Feeling or showing deep and solemn respect.", ["respectful", "devout"], ["irreverent", "disrespectful"], ["A reverent silence fell over the crowd during the memorial."]),
        ("v50", "Scarcity", "/ˈskeə.sə.ti/", "The state of being scarce or in short supply; shortage.", ["shortage", "dearth"], ["abundance", "plenty"], ["The drought caused a severe scarcity of clean drinking water."]),
    ]
    for v_id, word, phonetic, meaning, syns, ants, examp in vocab:
        conn.execute(
            """
            INSERT OR IGNORE INTO vocabulary_words (id, word, phonetic, meaning, synonyms_json, antonyms_json, examples_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (v_id, word, phonetic, meaning, json.dumps(syns), json.dumps(ants), json.dumps(examp))
        )

    # Pre-populate daily challenges
    from datetime import datetime, timezone, timedelta
    conn.execute("DELETE FROM daily_challenges")  # Purge legacy storytelling challenges
    for offset in range(-3, 3):  # Seed challenges from 3 days ago up to 2 days ahead
        date_str = (datetime.now(timezone.utc) + timedelta(days=offset)).strftime("%Y-%m-%d")
        is_gd = (offset % 2 == 0)
        conn.execute(
            """
            INSERT OR IGNORE INTO daily_challenges (id, challenge_date, challenge_type, title, prompt, reward)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                f"c_{date_str}",
                date_str,
                "gd" if is_gd else "picture_description",
                "GD: Group Discussion" if is_gd else "Picture Description",
                "Discuss: 'Should coding be a mandatory subject in primary schools?' Present your arguments." if is_gd else "Describe a peaceful park scene with families picnicking, kids playing, and autumn leaves falling.",
                "+20 XP"
            )
        )


    # Dynamic schema alterations for challenge completions feedback
    try:
        conn.execute("ALTER TABLE user_challenge_completions ADD COLUMN feedback TEXT")
    except Exception:
        pass
    try:
        conn.execute("ALTER TABLE user_challenge_completions ADD COLUMN transcript TEXT")
    except Exception:
        pass

