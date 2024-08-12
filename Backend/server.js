const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const qs = require('qs');

const app = express();
const port = process.env.PORT || 5002;

app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));


// Define a schema for storing access tokens
const tokenSchema = new mongoose.Schema({
    accessToken: String,
    refreshToken: String,
    expiresAt: Date,
});

const Token = mongoose.model('Token', tokenSchema);

// Login and get Upstox authorization
app.get('/auth/upstox', (req, res) => {
    const redirectUri = encodeURIComponent(process.env.REDIRECT_URI);
    const authUrl = `https://api.upstox.com/v2/login/authorization/dialog?client_id=${process.env.CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code`;
    console.log(authUrl);
    res.redirect(authUrl);
    
    
});

// Handle Upstox callback
// app.get('/auth/callback', async (req, res) => {
//     const code = req.query.code;
//     const tokenUrl = 'https://api.upstox.com/v2/login/authorization/token';

//     try {
//         const response = await axios.post(tokenUrl, null, {
//             params: {
//                 grant_type: 'authorization_code',
//                 code: code,
//                 redirect_uri: process.env.REDIRECT_URI,
//                 client_id: process.env.CLIENT_ID,
//                 client_secret: process.env.CLIENT_SECRET,
//             },
//         });

//         const { access_token, refresh_token, expires_in } = response.data;
//         const expiresAt = new Date(Date.now() + expires_in * 1000);

//         // Store tokens in the database
//         const tokenDoc = new Token({ accessToken: access_token, refreshToken: refresh_token, expiresAt });
//         await tokenDoc.save();

//         res.json({
//             access_token,
//             refresh_token,
//             expires_in,
//         });
//     } catch (error) {
//         res.status(error.response ? error.response.status : 500).json(error.response ? error.response.data : { error: 'An error occurred' });
//     }
// });


app.get('/auth/callback', async (req, res) => {
    const code = req.query.code;
    const tokenUrl = 'https://api.upstox.com/v2/login/authorization/token';

    try {
        const response = await axios.post(tokenUrl, qs.stringify({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: process.env.REDIRECT_URI,
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token, refresh_token, expires_in } = response.data;
        const expiresAt = new Date(Date.now() + expires_in * 1000);

        // Store tokens in the database
        const tokenDoc = new Token({ accessToken: access_token, refreshToken: refresh_token, expiresAt });
        await tokenDoc.save();

        res.json({
            access_token,
            refresh_token,
            expires_in,
        });
    } catch (error) {
        res.status(error.response ? error.response.status : 500).json(error.response ? error.response.data : { error: 'An error occurred' });
    }
});

// Get historical data
app.get('/api/historical', async (req, res) => {
    const symbol = 'NSE:NIFTY_50';
    const interval = '1day';
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 1 month ago
    const to = new Date().toISOString().split('T')[0];

    const tokenDoc = await Token.findOne();
    if (!tokenDoc) {
        return res.status(400).json({ error: 'No valid token found' });
    }

    const { accessToken } = tokenDoc;
    console.log(accessToken);
    

    try {
        const response = await axios.get(`https://api.upstox.com/live/history/${symbol}`, {
            params: { interval, from, to },
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        res.json(response.data);
    } catch (error) {
        res.status(error.response ? error.response.status : 500).json(error.response ? error.response.data : { error: 'An error occurred' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
