const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Endpoint to create a Payment Intent
app.post('/create-payment-intent', async (req, res) => {
  try {
    // Get the total amount from the request body (in USD)
    const { total } = req.body;

    // Convert total to cents (Stripe expects the amount in cents)
    const amountInCents = Math.round(total * 100);

    // Create a Payment Intent with the amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      payment_method_types: [
        'card',
        'apple_pay',
        'google_pay',
        'klarna',
        'afterpay_clearpay',
        'affirm',
        'ach_debit',
        'sepa_debit',
        'bancontact',
        'ideal',
        'boleto',
        'oxxo',
        'upi'
      ],
    });

    // Return the client secret to the client
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Error creating Payment Intent:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
