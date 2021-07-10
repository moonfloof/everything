import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';

// Load .env file
dotenv.config();

// Set up API
const app = express();
app.use(helmet());
app.use(express.json());

// Start server
app.listen(3000, () => {
	// eslint-disable-next-line no-console
	console.log('App running');
});
