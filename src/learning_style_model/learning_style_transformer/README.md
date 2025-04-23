# Learning Style Transformer Model

Place your trained transformer model files in this directory. The model should be compatible with HuggingFace's `AutoModelForSequenceClassification` format.

## Required Files

The following files should be present in this directory:

- `config.json` - Model configuration
- `pytorch_model.bin` - The model weights
- `tokenizer.json` - Tokenizer configuration
- `tokenizer_config.json` - Additional tokenizer configuration
- `vocab.txt` - Vocabulary file for the tokenizer

## Model Architecture

The model should be trained to predict learning style preferences across four dimensions:

1. **Processing**: Active vs. Reflective (output index 0)
2. **Perception**: Sensing vs. Intuitive (output index 1)
3. **Input**: Visual vs. Verbal (output index 2)
4. **Understanding**: Sequential vs. Global (output index 3)

Each dimension should produce a binary classification (0 or 1), corresponding to the first or second option in each pair.

## Training Data

This model should be trained on a dataset of responses to learning style assessment questions, annotated with the corresponding learning style classifications.

## Using a Custom Model

If you want to use a different model architecture or format, you'll need to modify the `server.py` file to load and use your model correctly.
