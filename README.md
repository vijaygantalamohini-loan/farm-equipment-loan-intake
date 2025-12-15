# Farm Equipment Loan Intake System

A full-stack loan application system with OCR-powered ID scanning for agricultural equipment financing.

## 🚀 Features

- **Automated ID Scanning**: Upload driver's license/ID images to auto-fill borrower information
- **Azure Computer Vision OCR**: Extracts name, DOB, and address from ID images
- **Multi-Step Wizard**: Borrower info → Co-borrower → Loan request → Documents & consents
- **FastAPI Backend**: Async Python API with intelligent OCR parsing heuristics
- **React Frontend**: Create React App with step-by-step form workflow
- **Unit Tests**: Comprehensive test coverage for OCR parsing logic

## 📁 Project Structure

```
FarmEquipment/
├── loan-intake-backend/       # FastAPI backend
│   ├── main.py               # API endpoints & OCR logic
│   ├── test_main.py          # Unit tests
│   ├── .env.example          # Environment template
│   └── requirements.txt      # Python dependencies
└── loan-intake-frontend/      # React frontend
    ├── src/
    │   ├── components/       # Form step components
    │   └── LoanApplicationWizard.js
    ├── package.json
    └── README.md
```

## 🛠️ Setup

### Prerequisites

- Python 3.9+
- Node.js 16+
- Azure Computer Vision API key ([Get one here](https://portal.azure.com))

### Backend Setup

1. **Navigate to backend folder**:
   ```bash
   cd loan-intake-backend
   ```

2. **Create virtual environment** (optional but recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your Azure credentials:
   ```
   AZURE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
   AZURE_KEY=your_subscription_key_here
   ```

5. **Run tests** (optional):
   ```bash
   pytest test_main.py -v
   ```

6. **Start the API server**:
   ```bash
   uvicorn main:app --reload --host 127.0.0.1 --port 8000
   ```
   API will be available at http://127.0.0.1:8000
   OpenAPI docs at http://127.0.0.1:8000/docs

### Frontend Setup

1. **Navigate to frontend folder**:
   ```bash
   cd loan-intake-frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm start
   ```
   App will open at http://localhost:3000

## 🎯 Usage

1. **Start both servers** (backend on :8000, frontend on :3000)
2. **Open** http://localhost:3000 in your browser
3. **Borrower Info Step**:
   - Click "Scan ID / Upload Image"
   - Upload a clear photo of a driver's license or ID
   - Fields auto-populate from OCR (name, DOB, address)
   - Review/edit and click "Next"
4. **Complete remaining steps**: Co-borrower, loan details, documents

## 🔌 API Endpoints

- `POST /ocr/id` - Upload ID image, returns extracted fields
- `POST /borrower` - Save borrower information
- `GET /borrower` - Retrieve saved borrower data
- `GET /docs` - Interactive API documentation

## 🧪 Testing

Run backend unit tests:
```bash
cd loan-intake-backend
pytest test_main.py -v
```

Run frontend tests:
```bash
cd loan-intake-frontend
npm test
```

## 📝 Environment Variables

### Backend (.env)

```bash
AZURE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_KEY=your_azure_cv_subscription_key
```

⚠️ **Never commit `.env` to version control!** Use `.env.example` as a template.

## 🚢 Deployment

### Backend (Python/FastAPI)

- Deploy to Azure App Service, AWS Lambda, or Heroku
- Set environment variables in your hosting platform
- Example (Azure):
  ```bash
  az webapp config appsettings set --name myapp --resource-group mygroup \
    --settings AZURE_ENDPOINT=https://... AZURE_KEY=...
  ```

### Frontend (React)

- Build for production:
  ```bash
  cd loan-intake-frontend
  npm run build
  ```
- Deploy `build/` folder to Netlify, Vercel, or Azure Static Web Apps

## 🔐 Security Notes

- `.env` file is gitignored - never commit secrets
- OCR API key stays on backend (not exposed to browser)
- CORS is configured for localhost:3000 and :3001 (update for production)
- Use HTTPS in production

## 🛠️ Technology Stack

**Backend**:
- FastAPI
- Python 3.9+
- Azure Computer Vision SDK
- httpx (async HTTP)
- pytest

**Frontend**:
- React 19
- Create React App
- Fetch API

## 📄 License

MIT License - feel free to use for your projects

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📧 Support

For issues or questions, please open an issue on GitHub.

---

Built with ❤️ for agricultural equipment financing
