import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from typing import List, Dict
import time

# singleton BERT model with:
# Lazy loading, Batch processing, CPU optimization and Memory efficiency
class OptimizedSentimentModel:
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
    
    # load model once
    def _initialize(self):
        start = time.time()
        
        model_name = "cardiffnlp/twitter-roberta-base-sentiment-latest"
        
        self._device = torch.device("cpu")
        
        self._tokenizer = AutoTokenizer.from_pretrained(model_name)
        self._model = AutoModelForSequenceClassification.from_pretrained(model_name)
        self._model.to(self._device)
        self._model.eval()  # Inference mode
        
        torch.set_num_threads(4)
        
        print(f"Model loaded")
    
    # analyze batch of texts
    def analyze_batch(self, texts: List[str], batch_size: int = 16) -> List[Dict]:
        results = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            
            # tokenize batch
            inputs = self._tokenizer(
                batch,
                return_tensors='pt',
                truncation=True,
                max_length=512,
                padding=True
            )
            
            # move to device
            inputs = {k: v.to(self._device) for k, v in inputs.items()}
            
            # inference
            with torch.no_grad():
                outputs = self._model(**inputs)
                probs = torch.softmax(outputs.logits, dim=-1).cpu().numpy()
            
            # process results
            # model outputs: [negative, neutral, positive]
            for prob in probs:
                pred_idx = prob.argmax()
                confidence = float(prob[pred_idx])
                
                # map to sentiment
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
    
    # analyze single text
    def analyze_single(self, text: str) -> Dict:
        return self.analyze_batch([text])[0]
