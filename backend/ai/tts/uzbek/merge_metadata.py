import os

# WAV va TXT fayllar joylashgan papka
wavs_dir = "wavs"
output_file = "metadata.csv"

# .wav fayllar ro‘yxatini olamiz (ikki formatda ham)
wav_files = sorted([f for f in os.listdir(wavs_dir) if f.endswith(".wav")])

with open(output_file, "w", encoding="utf-8") as f:
    for wav_file in wav_files:
        base = os.path.splitext(wav_file)[0]  # 001 yoki 0001
        txt_file = f"{base}.txt"
        txt_path = os.path.join(wavs_dir, txt_file)

        if os.path.exists(txt_path):
            # Matnni o‘qiymiz
            with open(txt_path, "r", encoding="utf-8") as tf:
                text = tf.read().strip()
            
            # metadata formatida yozamiz
            f.write(f"wavs/{wav_file}|{text}\n")
        else:
            print(f"⚠️ Matn topilmadi: {txt_file}")

print("✅ Birlashtirilgan metadata.csv tayyor!")
