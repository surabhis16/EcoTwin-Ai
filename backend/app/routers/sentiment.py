from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import os
from supabase import create_client, Client

import sys
BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)
from models.sentiment_model import OptimizedSentimentModel
from services.data_collector import DataCollector
from services.text_preprocessor import TextPreprocessor
from services.sentiment_processor import SentimentProcessor

router = APIRouter(prefix="/api/sentiment", tags=["Sentiment"])

supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY")  
)

sentiment_model = None

def get_model():
    global sentiment_model
    if sentiment_model is None:
        sentiment_model = OptimizedSentimentModel()
    return sentiment_model

# models

class AnalyzeTextRequest(BaseModel):
    text: str
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

# helpers

def find_ward_by_coords(lat: float, lon: float) -> Optional[int]:
    """Find ward number for given coordinates"""
    try:
        result = supabase.rpc('get_ward_by_coordinates', {
            'longitude': lon,
            'latitude': lat
        }).execute()
        
        if result.data and len(result.data) > 0:
            return result.data[0].get('ward_number')
    except Exception as e:
        print(f"Error finding ward: {e}")
    
    return None

# endpoints

@router.get("/all-wards-sentiment")
def get_all_wards_sentiment():
    try:
        result = supabase.table('ward_sentiment_summary').select('*').execute()
        
        data = {}
        for row in result.data:
            data[row['ward_number']] = {
                'ward_name': row['ward_name_en'],
                'lon': row['lon'],
                'lat': row['lat'],
                'post_count': row['post_count'] or 0,
                'sentiment_score': round(row['avg_sentiment_score'] or 0, 3),
                'sentiment': row['dominant_sentiment'] or 'neutral',
                'confidence': round(row['avg_confidence'] or 0, 3),
                'stress_risk': row['stress_risk'] or 'low'
            }
        
        return data
    except Exception as e:
        raise HTTPException(500, f"Database error: {str(e)}")

@router.get("/ward-sentiment/{ward_number}")
def get_ward_sentiment(ward_number: int):
    try:
        ward_result = supabase.table('bengaluru_wards')\
            .select('ward_number, ward_name_en')\
            .eq('ward_number', ward_number)\
            .single()\
            .execute()
        
        if not ward_result.data:
            raise HTTPException(404, "Ward not found")
        
        sentiment_result = supabase.table('ward_sentiment_summary')\
            .select('*')\
            .eq('ward_number', ward_number)\
            .single()\
            .execute()
        
        if sentiment_result.data:
            return {
                'ward_number': ward_number,
                'ward_name': ward_result.data['ward_name_en'],
                'post_count': sentiment_result.data.get('post_count', 0),
                'sentiment_score': sentiment_result.data.get('avg_sentiment_score', 0),
                'sentiment': sentiment_result.data.get('dominant_sentiment', 'neutral'),
                'confidence': sentiment_result.data.get('avg_confidence', 0),
                'stress_risk': sentiment_result.data.get('stress_risk', 'low')
            }
        else:
            return {
                'ward_number': ward_number,
                'ward_name': ward_result.data['ward_name_en'],
                'post_count': 0,
                'sentiment_score': 0,
                'sentiment': 'neutral',
                'confidence': 0,
                'stress_risk': 'low'
            }
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/hotspots")
def get_hotspots(risk_level: str = "high", limit: int = 10):
    try:
        result = supabase.table('public_sentiment')\
            .select('ward_number, location, latitude, longitude, sentiment_score, text_content, policy_category, source_url, created_at, platform')\
            .eq('stress_risk', risk_level)\
            .not_.is_('ward_number', 'null')\
            .order('sentiment_score', desc=False)\
            .limit(limit)\
            .execute()
        
        hotspots = []
        for row in result.data:
            hotspots.append({
                'ward_number': row['ward_number'],
                'location': row['location'],
                'latitude': row['latitude'],
                'longitude': row['longitude'],
                'sentiment_score': row['sentiment_score'],
                'policy_category': row['policy_category'],
                'example_feedback': row['text_content'][:200] if row['text_content'] else None,
                'source_url': row.get('source_url', ''),
                'created_at': row.get('created_at', ''),
                'platform': row.get('platform', 'unknown')
            })
        
        return {
            'risk_level': risk_level,
            'count': len(hotspots),
            'hotspots': hotspots
        }
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/city-wide-sentiment")
def get_city_wide_sentiment(limit: int = 20):
    try:
        result = supabase.table('public_sentiment')\
            .select('location, latitude, longitude, sentiment, sentiment_score, confidence, text_content, policy_category, source_url, created_at, platform, stress_risk')\
            .is_('ward_number', 'null')\
            .order('created_at', desc=True)\
            .limit(limit)\
            .execute()
        
        posts = []
        for row in result.data:
            posts.append({
                'location': row['location'],
                'latitude': row['latitude'],
                'longitude': row['longitude'],
                'sentiment': row['sentiment'],
                'sentiment_score': row['sentiment_score'],
                'confidence': row['confidence'],
                'text_preview': row['text_content'][:150] if row['text_content'] else '',
                'text_full': row['text_content'],
                'policy_category': row['policy_category'],
                'source_url': row.get('source_url', ''),
                'created_at': row.get('created_at', ''),
                'platform': row.get('platform', 'unknown'),
                'stress_risk': row.get('stress_risk', 'low')
            })
        
        return {
            'count': len(posts),
            'posts': posts
        }
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/statistics")
def get_statistics():
    try:
        total_result = supabase.table('public_sentiment')\
            .select('*', count='exact')\
            .not_.is_('ward_number', 'null')\
            .execute()
        
        total_count = total_result.count or 0
        
        citywide_result = supabase.table('public_sentiment')\
            .select('*', count='exact')\
            .is_('ward_number', 'null')\
            .execute()
        
        citywide_count = citywide_result.count or 0
        
        if total_count == 0:
            return {
                'total_feedback': 0,
                'citywide_feedback': citywide_count,
                'avg_sentiment': 0,
                'distribution': {'positive': 0, 'negative': 0, 'neutral': 0},
                'high_stress_zones': 0,
                'wards_covered': 0,
                'categories_covered': 0
            }
        
        positive_result = supabase.table('public_sentiment')\
            .select('*', count='exact')\
            .eq('sentiment', 'positive')\
            .not_.is_('ward_number', 'null')\
            .execute()
        
        negative_result = supabase.table('public_sentiment')\
            .select('*', count='exact')\
            .eq('sentiment', 'negative')\
            .not_.is_('ward_number', 'null')\
            .execute()
        
        neutral_result = supabase.table('public_sentiment')\
            .select('*', count='exact')\
            .eq('sentiment', 'neutral')\
            .not_.is_('ward_number', 'null')\
            .execute()
        
        high_stress_result = supabase.table('public_sentiment')\
            .select('*', count='exact')\
            .eq('stress_risk', 'high')\
            .not_.is_('ward_number', 'null')\
            .execute()
        
        all_records = supabase.table('public_sentiment')\
            .select('sentiment_score')\
            .not_.is_('ward_number', 'null')\
            .execute()
        
        avg_sentiment = 0
        if all_records.data:
            scores = [r['sentiment_score'] for r in all_records.data if r.get('sentiment_score') is not None]
            avg_sentiment = sum(scores) / len(scores) if scores else 0
        
        wards_result = supabase.table('public_sentiment')\
            .select('ward_number')\
            .not_.is_('ward_number', 'null')\
            .execute()
        
        unique_wards = len(set(r['ward_number'] for r in wards_result.data if r.get('ward_number')))
        
        categories_result = supabase.table('public_sentiment')\
            .select('policy_category')\
            .not_.is_('ward_number', 'null')\
            .execute()
        
        unique_categories = len(set(r['policy_category'] for r in categories_result.data if r.get('policy_category')))
        
        return {
            'total_feedback': total_count,
            'citywide_feedback': citywide_count, 
            'avg_sentiment': round(avg_sentiment, 3),
            'distribution': {
                'positive': positive_result.count or 0,
                'negative': negative_result.count or 0,
                'neutral': neutral_result.count or 0
            },
            'high_stress_zones': high_stress_result.count or 0,
            'wards_covered': unique_wards,
            'categories_covered': unique_categories
        }
    except Exception as e:
        print(f"Statistics error: {e}")
        return {
            'total_feedback': 0,
            'citywide_feedback': 0,
            'avg_sentiment': 0,
            'distribution': {'positive': 0, 'negative': 0, 'neutral': 0},
            'high_stress_zones': 0,
            'wards_covered': 0,
            'categories_covered': 0
        }

@router.post("/analyze-text")
def analyze_text(request: AnalyzeTextRequest):
    try:
        model = get_model()
        clean_text = SentimentProcessor.clean_text(request.text)
        result = model.analyze_single(clean_text)
        
        # Try to extract location from text
        loc_data = SentimentProcessor.extract_location(clean_text)
        
        if loc_data:
            # Real location extracted
            location, lat, lon = loc_data
            ward_number = find_ward_by_coords(lat, lon)
            print(f"✓ Location extracted: {location} → Ward {ward_number}")
        else:
            # No location found => city-wide post
            location = "Bangalore (General)"
            lat, lon = 12.9716, 77.5946  
            ward_number = None  
            print(f"✗ No location found → City-Wide")
        
        category = SentimentProcessor.categorize_policy(clean_text)
        stress_risk = SentimentProcessor.calculate_stress_risk(
            result['sentiment_score'],
            category
        )
        
        supabase.table('public_sentiment').insert({
            'ward_number': ward_number,
            'location': location,
            'latitude': lat,
            'longitude': lon,
            'sentiment': result['sentiment'],
            'sentiment_score': result['sentiment_score'],
            'confidence': result['confidence'],
            'policy_category': category,
            'text_content': clean_text[:500],
            'stress_risk': stress_risk,
            'platform': 'manual'
        }).execute()
        
        return {
            'ward_number': ward_number,
            'location': location,
            **result,
            'policy_category': category,
            'stress_risk': stress_risk
        }
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/collect-reddit")
def trigger_reddit_collection(background_tasks: BackgroundTasks, max_posts: int = 100):
    background_tasks.add_task(collect_and_store_reddit, max_posts)
    return {
        'status': 'started',
        'message': f'Collecting up to {max_posts} Reddit posts in background'
    }

def collect_and_store_reddit(max_posts: int = 100):
    try:
        print(f"Starting Sentiment Collection")
        
        collector = DataCollector()
        preprocessor = TextPreprocessor()
        model = get_model()
        
        reddit_limit = max_posts // 2
        news_limit = max_posts // 2
        
        all_data = collector.collect_all(
            reddit_max=reddit_limit,
            news_max=news_limit
        )
        
        if not all_data:
            print("No data collected")
            return
        
        print(f"Preprocessing {len(all_data)} texts...")
        cleaned_texts = []
        for item in all_data:
            clean = preprocessor.preprocess_for_sentiment(item['full_text'])
            cleaned_texts.append(clean)
            item['cleaned_text'] = clean
        
        print(f"Analyzing sentiment...")
        sentiments = model.analyze_batch(cleaned_texts, batch_size=16)
        
        print(f"Processing and storing...")
        stored_count = 0
        citywide_count = 0
        ward_count = 0
        
        for item, sentiment in zip(all_data, sentiments):
            # Extract location
            loc_data = SentimentProcessor.extract_location(item['cleaned_text'])
            
            if loc_data:
                # Real location found
                location, lat, lon = loc_data
                ward_number = find_ward_by_coords(lat, lon)
                
                if ward_number:
                    ward_count += 1
                    # print(f" Ward post: {location} - Ward {ward_number}")
                else:
                    citywide_count += 1
                    # print(f" Out-of-bounds: {location} - City-Wide")
            else:
                # No location mentioned - city-wide
                location = "Bangalore (General)"
                lat, lon = 12.9716, 77.5946
                ward_number = None
                citywide_count += 1
                # print(f" Generic post => City-Wide")
            
            category = SentimentProcessor.categorize_policy(item['cleaned_text'])
            stress_risk = SentimentProcessor.calculate_stress_risk(
                sentiment['sentiment_score'],
                category
            )
            
            features = preprocessor.extract_urban_features(item['cleaned_text'])
            dominant_theme = max(features, key=features.get) if features else 'general'
            
            try:
                supabase.table('public_sentiment').insert({
                    'ward_number': ward_number,
                    'location': location,
                    'latitude': lat,
                    'longitude': lon,
                    'sentiment': sentiment['sentiment'],
                    'sentiment_score': sentiment['sentiment_score'],
                    'confidence': sentiment['confidence'],
                    'policy_category': category,
                    'text_content': item['cleaned_text'][:500],
                    'dominant_theme': dominant_theme.replace('mentions_', ''),
                    'stress_risk': stress_risk,
                    'platform': item.get('platform', 'unknown'),
                    'source_url': item.get('url', '')
                }).execute()
                
                stored_count += 1
            except Exception as e:
                if 'duplicate key value' not in str(e).lower():
                    print(f" Error storing: {e}")
        
        print(f"\nRefreshing aggregated view...")
        try:
            supabase.rpc('refresh_sentiment_summary').execute()
        except:
            print("Could not refresh view")
        
        print(f"\nCollection Complete")
        print(f"  Total collected: {len(all_data)}")
        print(f"  Successfully stored: {stored_count}")
        print(f"  Ward-specific: {ward_count}")
        print(f"  City-wide: {citywide_count}")
        print(f"  Reddit: {sum(1 for d in all_data if d.get('platform') == 'reddit')}")
        print(f"  News: {sum(1 for d in all_data if d.get('platform') == 'news')}")
        
    except Exception as e:
        print(f"Collection failed: {e}")
        import traceback
        traceback.print_exc()
