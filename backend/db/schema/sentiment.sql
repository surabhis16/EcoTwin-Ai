CREATE TABLE IF NOT EXISTS public_sentiment (
    id BIGSERIAL PRIMARY KEY,

    ward_number INTEGER
        REFERENCES bengaluru_wards(ward_number)
        ON DELETE CASCADE,

    location TEXT NOT NULL,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,

    sentiment TEXT NOT NULL
        CHECK (sentiment IN ('positive', 'negative', 'neutral')),

    sentiment_score FLOAT NOT NULL
        CHECK (sentiment_score BETWEEN -1 AND 1),

    confidence FLOAT NOT NULL
        CHECK (confidence BETWEEN 0 AND 1),

    policy_category TEXT
        CHECK (policy_category IN ('infrastructure', 'water', 'urban_planning', 'general'))
        DEFAULT 'general',

    platform TEXT DEFAULT 'reddit',

    text_content TEXT,
    dominant_theme TEXT,

    stress_risk TEXT
        CHECK (stress_risk IN ('high', 'medium', 'low'))
        DEFAULT 'low',

    source_url TEXT UNIQUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_sentiment_ward
    ON public_sentiment (ward_number);

CREATE INDEX IF NOT EXISTS idx_sentiment_location
    ON public_sentiment (location);

CREATE INDEX IF NOT EXISTS idx_sentiment_created
    ON public_sentiment (created_at);

CREATE INDEX IF NOT EXISTS idx_sentiment_stress
    ON public_sentiment (stress_risk);

CREATE INDEX IF NOT EXISTS idx_sentiment_score
    ON public_sentiment (sentiment_score);

CREATE INDEX IF NOT EXISTS idx_sentiment_url
    ON public_sentiment (source_url);


CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sentiment_updated_at
ON public_sentiment;

CREATE TRIGGER update_sentiment_updated_at
BEFORE UPDATE ON public_sentiment
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public_sentiment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access"
ON public_sentiment;

CREATE POLICY "Allow public read access"
ON public_sentiment
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow service role insert"
ON public_sentiment;

CREATE POLICY "Allow service role insert"
ON public_sentiment
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE MATERIALIZED VIEW ward_sentiment_summary AS
SELECT
    w.ward_number,
    w.ward_name_en,
    ST_X(w.centroid) AS lon,
    ST_Y(w.centroid) AS lat,

    COUNT(s.id) AS post_count,
    AVG(s.sentiment_score) AS avg_sentiment_score,

    MODE() WITHIN GROUP (ORDER BY s.sentiment) AS dominant_sentiment,
    AVG(s.confidence) AS avg_confidence,
    MODE() WITHIN GROUP (ORDER BY s.stress_risk) AS stress_risk,
    MODE() WITHIN GROUP (ORDER BY s.policy_category) AS dominant_category,

    MAX(s.created_at) AS last_updated

FROM bengaluru_wards w
LEFT JOIN public_sentiment s
    ON w.ward_number = s.ward_number
   AND s.created_at > NOW() - INTERVAL '30 days'

GROUP BY
    w.ward_number,
    w.ward_name_en,
    w.centroid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ward_sentiment_summary_unique
ON ward_sentiment_summary (ward_number);

CREATE INDEX IF NOT EXISTS idx_ward_sentiment_summary_ward
ON ward_sentiment_summary (ward_number);

DROP FUNCTION IF EXISTS refresh_sentiment_summary();

CREATE FUNCTION refresh_sentiment_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY ward_sentiment_summary;
END;
$$ LANGUAGE plpgsql;
