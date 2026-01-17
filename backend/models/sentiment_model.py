import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from typing import List, Dict
import time

class OptimizedSentimentModel:
    """
    Singleton BERT model with:
    - Lazy loading
    - Batch processing
    - CPU optimization
    - Memory efficiency
    """
    
    _instance = None
    _model = None
    _tokenizer = None
    _device = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._model is None:
            self._initialize()
    
    def _initialize(self):
        """Load model once"""
        print("🔄 Loading sentiment model (one-time setup)...")
        start = time.time()
        
        model_name = "cardiffnlp/twitter-roberta-base-sentiment-latest"
        
        # Use CPU for stability (BERT is fast enough)
        self._device = torch.device("cpu")
        
        self._tokenizer = AutoTokenizer.from_pretrained(model_name)
        self._model = AutoModelForSequenceClassification.from_pretrained(model_name)
        self._model.to(self._device)
        self._model.eval()  # Inference mode
        
        # Optimize for CPU
        torch.set_num_threads(4)
        
        print(f"✓ Model loaded in {time.time() - start:.2f}s")
    
    def analyze_batch(self, texts: List[str], batch_size: int = 16) -> List[Dict]:
        """
        Analyze sentiment for multiple texts efficiently
        
        Args:
            texts: List of text strings
            batch_size: Number of texts to process at once
            
        Returns:
            List of dicts with sentiment, score, confidence
        """
        results = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            
            # Tokenize batch
            inputs = self._tokenizer(
                batch,
                return_tensors='pt',
                truncation=True,
                max_length=512,
                padding=True
            )
            
            # Move to device
            inputs = {k: v.to(self._device) for k, v in inputs.items()}
            
            # Inference
            with torch.no_grad():
                outputs = self._model(**inputs)
                probs = torch.softmax(outputs.logits, dim=-1).cpu().numpy()
            
            # Process results
            # Model outputs: [negative, neutral, positive]
            for prob in probs:
                pred_idx = prob.argmax()
                confidence = float(prob[pred_idx])
                
                # Map to sentiment
                sentiment_map = {0: 'negative', 1: 'neutral', 2: 'positive'}
                sentiment = sentiment_map[pred_idx]
                
                # Calculate score (-1 to 1)
                if sentiment == 'positive':
                    score = confidence
                elif sentiment == 'negative':
                    score = -confidence
                else:
                    score = 0.0
                
                results.append({
                    'sentiment': sentiment,
                    'confidence': confidence,
                    'sentiment_score': round(score, 3)
                })
        
        return results
    
    def analyze_single(self, text: str) -> Dict:
        """Analyze single text"""
        return self.analyze_batch([text])[0]
