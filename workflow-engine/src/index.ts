import 'dotenv/config';
import { App } from './app';

const PORT = parseInt(process.env.PORT || '3005');

const app = new App();

app.initialize()
  .then(() => {
    app.listen(PORT);
  })
  .catch((error) => {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  });

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});
