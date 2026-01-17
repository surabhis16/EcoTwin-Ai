from dotenv import load_dotenv
load_dotenv()

import requests
import time

BASE_URL = "http://localhost:8000"

def test_sentiment_api():
    print("Testing Sentiment Analysis API")
    print("=" * 60)

    # test 1: analyze single text
    print("\n1. Testing /analyze-text endpoint")

    payload = {
        "text": "The new metro line in Whitefield is amazing, but traffic nearby is horrible.",
        "location": "Whitefield",
        "latitude": 12.9698,
        "longitude": 77.7499
    }

    response = requests.post(
        f"{BASE_URL}/api/sentiment/analyze-text",
        json=payload,
        timeout=30
    )

    if response.status_code != 200:
        print("analyze-text failed")
        print(response.text)
        return

    result = response.json()
    print("Sentiment result:")
    print(result)

    time.sleep(2)

    # test 2: get all wards sentiment
    print("\n2. Testing /all-wards-sentiment")

    response = requests.get(
        f"{BASE_URL}/api/sentiment/all-wards-sentiment",
        timeout=30
    )

    if response.status_code != 200:
        print("all-wards-sentiment failed")
        print(response.text)
        return

    wards = response.json()
    print(f"Retrieved sentiment for {len(wards)} wards")

    if wards:
        sample_ward = next(iter(wards.values()))
        print("Sample ward data:")
        print(sample_ward)

    time.sleep(2)

    # test 3: Ward-specific sentiment
    print("\n3. Testing /ward-sentiment/{ward_number}")

    test_ward = result.get("ward_number")
    if test_ward:
        response = requests.get(
            f"{BASE_URL}/api/sentiment/ward-sentiment/{test_ward}",
            timeout=30
        )

        if response.status_code == 200:
            print("Ward sentiment:")
            print(response.json())
        else:
            print("ward-sentiment failed")
            print(response.text)
    else:
        print("No ward_number returned from analyze-text")

    time.sleep(2)

    # test 4: Hotspots
    print("\n4. Testing /hotspots")

    response = requests.get(
        f"{BASE_URL}/api/sentiment/hotspots?risk_level=high&limit=5",
        timeout=30
    )

    if response.status_code == 200:
        hotspots = response.json()
        print("Hotspots:")
        print(hotspots)
    else:
        print("hotspots failed")
        print(response.text)

    time.sleep(2)

    # test 5: Statistics
    print("\n5. Testing /statistics")

    response = requests.get(
        f"{BASE_URL}/api/sentiment/statistics",
        timeout=30
    )

    if response.status_code == 200:
        stats = response.json()
        print("Statistics:")
        print(stats)
    else:
        print("statistics failed")
        print(response.text)

    print("\nAll tests completed")


if __name__ == "__main__":
    test_sentiment_api()
