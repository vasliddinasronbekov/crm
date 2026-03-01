# ai/training/train_intent_sklearn.py
import argparse
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import joblib
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
OUT_DIR = BASE / "intent_model"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=str, required=True, help="Path to intents.csv")
    parser.add_argument("--test_size", type=float, default=0.2, help="Validation split size")
    args = parser.parse_args()

    # Load data
    df = pd.read_csv(args.data)
    X = df["text"].astype(str)
    y = df["intent"].astype(str)

    # Stratify only if dataset big enough
    n_classes = y.nunique()
    min_required = (1 / args.test_size) * n_classes
    stratify = y if len(df) >= min_required else None

    # Split
    X_train, X_val, y_train, y_val = train_test_split(
        X, y,
        test_size=args.test_size,
        random_state=42,
        stratify=stratify
    )

    # Pipeline
    pipe = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), max_features=20000)),
        ("clf", LogisticRegression(max_iter=1000))
    ])

    pipe.fit(X_train, y_train)
    pred = pipe.predict(X_val)
    print(classification_report(y_val, pred))

    # Save model
    joblib.dump(pipe, OUT_DIR / "pipeline.joblib")
    print("✅ Model saved to", OUT_DIR / "pipeline.joblib")
    print(df.head())


if __name__ == "__main__":
    main()
