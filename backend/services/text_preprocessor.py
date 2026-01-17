import re
import spacy
from typing import List, Dict

class TextPreprocessor:
    
    _instance = None
    _nlp = None
    
    def __new__(cls):
        """Singleton to load spaCy model once"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._nlp is None:
            self._load_spacy()
    
    def _load_spacy(self):
        try:
            self._nlp = spacy.load('en_core_web_sm')
            print("loaded spaCy model")
        except OSError:
            print("downloading spaCy model...")
            import os
            os.system('python -m spacy download en_core_web_sm')
            self._nlp = spacy.load('en_core_web_sm')
    
    def clean_text(self, text: str) -> str:
        if not isinstance(text, str):
            return ""
        
        # Convert to lowercase
        text = text.lower()
        
        # Remove URLs
        text = re.sub(r'http\S+|www\.\S+', '', text)
        
        # Remove email addresses
        text = re.sub(r'\S+@\S+', '', text)
        
        # Remove user mentions (@username)
        text = re.sub(r'@\w+', '', text)
        
        # Remove hashtags but keep the text
        text = re.sub(r'#(\w+)', r'\1', text)
        
        # Remove special characters but keep basic punctuation
        text = re.sub(r'[^a-zA-Z0-9\s.,!?-]', '', text)
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text
    
    def remove_stopwords(self, text: str) -> str:
        doc = self._nlp(text)
        tokens = [token.text for token in doc if not token.is_stop and not token.is_punct]
        return ' '.join(tokens)
    
    def lemmatize(self, text: str) -> str:
        doc = self._nlp(text)
        lemmas = [token.lemma_ for token in doc if not token.is_punct]
        return ' '.join(lemmas)
    
    def extract_urban_features(self, text: str) -> Dict[str, int]:
        text_lower = text.lower()
        
        stress_keywords = {
            'traffic': ['traffic', 'congestion', 'jam', 'stuck', 'gridlock'],
            'pollution': ['pollution', 'smog', 'air quality', 'dust', 'smoke'],
            'noise': ['noise', 'loud', 'honking', 'construction', 'disturbance'],
            'infrastructure': ['potholes', 'roads', 'maintenance', 'broken', 'repair'],
            'commute': ['commute', 'travel time', 'distance', 'transit'],
            'development': ['development', 'construction', 'building', 'project']
        }
        
        features = {}
        for category, keywords in stress_keywords.items():
            count = sum(1 for keyword in keywords if keyword in text_lower)
            features[f'mentions_{category}'] = count
        
        return features
    
    def preprocess_for_sentiment(self, text: str, keep_stopwords: bool = True) -> str:
        """
        preprocess text for BERT-based sentiment analysis
        
        For BERT models:
        1. Clean text (remove URLs, mentions, etc.)
        2. Keep stopwords (they carry sentiment)
        3. Don't lemmatize (BERT handles morphology)
        
        """
        # Basic cleaning
        cleaned = self.clean_text(text)
        
        # optionally remove stopwords (not recc for bert)
        if not keep_stopwords:
            cleaned = self.remove_stopwords(cleaned)
        
        return cleaned
    
    def process_batch(self, texts: List[str]) -> List[str]:
        return [self.preprocess_for_sentiment(text) for text in texts]
    
    def analyze_text_stats(self, text: str) -> Dict:
        doc = self._nlp(text)
        
        return {
            'text_length': len(text),
            'word_count': len([token for token in doc if not token.is_punct]),
            'sentence_count': len(list(doc.sents)),
            'avg_word_length': sum(len(token.text) for token in doc if not token.is_punct) / max(len([t for t in doc if not t.is_punct]), 1)
        }