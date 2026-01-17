import re
import os
from typing import Dict, List, Tuple, Optional
from supabase import create_client

POLICY_KEYWORDS = {
    'infrastructure': ['bbmp', 'metro', 'flyover', 'road', 'bridge', 'traffic', 'construction', 'pothole', 'signal'],
    'water': ['water', 'bwssb', 'lake', 'cauvery', 'borewell', 'tanker', 'shortage', 'flood', 'drain'],
    'urban_planning': ['park', 'tree', 'green', 'zoning', 'building', 'development', 'planning', 'encroachment', 'garbage', 'waste']
}

class SentimentProcessor:
    
    _ward_cache = None

    @classmethod
    def _get_ward_cache(cls):
        """
        lazy-load ward data from db
        """
        if cls._ward_cache is not None:
            return cls._ward_cache

        try:
            supabase = create_client(
                os.getenv("SUPABASE_URL"),
                os.getenv("SUPABASE_SERVICE_KEY")
            )
            
            # Fetch ward names and centroids
            response = supabase.table('ward_sentiment_summary').select('ward_name_en, lat, lon').execute()
            
            cls._ward_cache = {}
            
            if response.data:
                for row in response.data:
                    raw_name = row.get('ward_name_en', '').strip()
                    if not raw_name:
                        continue
                        
                    # split by hyphen and take the last part if a number exists
                    if '-' in raw_name and raw_name.split('-')[0].strip().isdigit():
                        clean_name = raw_name.split('-', 1)[1].strip()
                    else:
                        clean_name = raw_name
                    
                    # store both versions (just in case)
                    cls._ward_cache[clean_name.lower()] = (raw_name, row['lat'], row['lon'])
                    cls._ward_cache[raw_name.lower()] = (raw_name, row['lat'], row['lon'])
            
            print(f"Loaded {len(cls._ward_cache)} wards for geocoding")
            return cls._ward_cache
            
        except Exception as e:
            print(f"Failed to load wards from DB: {e}")
            return {}

    @staticmethod
    def extract_location(text: str) -> Optional[Tuple[str, float, float]]:
        """
        extract location from text by matching against db wards
        """
        text_lower = text.lower()
        ward_map = SentimentProcessor._get_ward_cache()
        
        # exact name matching from DB
        for name_lower, data in ward_map.items():
            # Use specific boundary checks to avoid partial matches
            # e.g. ensure "Bellandur" matches "Bellanduru" but not "Bellandur Road" if that's an issue
            if name_lower in text_lower:
                return data
        
        # 2. hardcoded aliases for now (map common slang to official db names)
        if 'hsr' in text_lower:
            # Look for "HSR Layout" or "174-HSR Layout" in cache
            for key in ward_map:
                if 'hsr layout' in key: return ward_map[key]
        
        if 'btm' in text_lower:
             for key in ward_map:
                if 'btm layout' in key: return ward_map[key]
                
        if 'electronic city' in text_lower or 'ecity' in text_lower:
             # E-City is NOT in BBMP, so return explicit None to force City-Wide
             return None

        return None
    
    @staticmethod
    def categorize_policy(text: str) -> str:
        text_lower = text.lower()
        for category, keywords in POLICY_KEYWORDS.items():
            if any(keyword in text_lower for keyword in keywords):
                return category
        return 'general'
    
    @staticmethod
    def calculate_stress_risk(sentiment_score: float, category: str) -> str:
        critical_categories = ['water', 'infrastructure']
        if sentiment_score < -0.5:
            return 'high' if category in critical_categories else 'medium'
        elif sentiment_score < -0.2:
            return 'medium' if category in critical_categories else 'low'
        else:
            return 'low'
    
    @staticmethod
    def clean_text(text: str) -> str:
        if not text: return ""
        text = re.sub(r'http\S+|www\.\S+', '', text)
        text = re.sub(r'\s+', ' ', text).strip()
        return text