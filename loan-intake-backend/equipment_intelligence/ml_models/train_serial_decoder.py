from pathlib import Path

from equipment_intelligence.ml_models.serial_decoder.trainer import train_serial_decoder_models


def main():
    model_dir = Path(__file__).parent / "models"
    metrics = train_serial_decoder_models(model_dir=model_dir)
    print("Serial decoder models saved:")
    for target, info in metrics.items():
        accuracy = info.get("accuracy")
        classes = info.get("classes")
        print(f"  {target}: accuracy={accuracy:.3f} classes={int(classes)}")


if __name__ == "__main__":
    main()
