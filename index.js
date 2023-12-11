const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_KEY)

const port = process.env.PORT || 5001;
//middleware
app.use(cors());
const jwt = require('jsonwebtoken');
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' })
  }
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@mongodb-demo.z2x5gnd.mongodb.net/?retryWrites=true&w=majority;`
 const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wzxwdjd.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const instructorCollection = client.db("summerCamp").collection("instructor");
    const classCollection = client.db("summerCamp").collection("class");
    const cartCollection = client.db("summerCamp").collection("varts");
    const userCollection = client.db("summerCamp").collection("users");
    const paymentCollection = client.db("summerCamp").collection("payments");

    //jwt
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token })
    })
    //verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      // console.log(email);
      const query = { email: email }
      const user = await userCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' })
      }
      next();
    }
    // check user admin on not
    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }
      const query = { email: email }
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send({ result: result });
    })
    //verify instructor
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      // console.log(email);
      const query = { email: email }
      const user = await userCollection.findOne(query);
      if (user?.role !== 'Instructor') {
        return res.status(403).send({ error: true, message: 'forbidden message' })
      }
      next();
    }
    // check user instructor on not
    app.get('/users/Instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false })
      }
      const query = { email: email }
      const user = await userCollection.findOne(query);
      const result = { instructor: user?.role === 'Instructor' }
      res.send({ result: result });
    })
    //user related api
    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    })


    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })
    // User => admin
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    })
    // User => Instructor
    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'Instructor'
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    })
    // update approve
    app.patch('/class/approve/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'approve'
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    })
    // update deny
    app.patch('/class/deny/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'deny'
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    })
    // update feedback
    app.patch('/class/feedback/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          feedback: req.body.feedback
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    })
    //user delete
    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })
    // createpayment

    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      // console.log(paymentIntent);
      res.send({
        clientSecret: paymentIntent.client_secret
      })


    })
    //payment related api
    app.post('/payments', verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);

      const query = { _id: { $in: payment.cartItems.map(id => new ObjectId(id)) } }
      const deleteResult = await cartCollection.deleteOne(query)
      res.send({ insertResult, deleteResult });
    })

    app.get('/payments', async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    })
    //instructor
    app.get('/instructor', async (req, res) => {
      const result = await instructorCollection.find().toArray();
      res.send(result);
    })

    app.post('/instructor', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await instructorCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }
      const result = await instructorCollection.insertOne(user);
      res.send(result);
    })
    //class
    app.get('/class', async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    })

    app.post('/class', async (req, res) => {
      const newItem = req.body;
      const result = await classCollection.insertOne(newItem);
      res.send(result);
    })
    //update other data class
    // app.patch('/class/approve/:id', async (req, res) => {
    //   const id = req.params.id;
    //   const filter = { _id: new ObjectId(id) };
    //   const updateDoc = {
    //     $set: {
    //       status: 'approve'
    //     },
    //   };
    //   const result = await classCollection.updateOne(filter, updateDoc);
    //   res.send(result);
    // })
    //update seat

    app.patch('/class/seat/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          availableSeats: req.body.availableSeats,
          enrollCount: req.body.enrollCount
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    //carts
    app.get('/carts', verifyJWT, async (req, res) => {
      const email = req.query.email;
      // console.log(email);
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if (email != decodedEmail) {
        return res.status(401).send({ error: true, message: 'forviden access' })
      }
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.post('/carts', async (req, res) => {
      const item = req.body;
      const result = await cartCollection.insertOne(item);
      res.send(result);
    })
    //cart items delete
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    })
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Sun is on the sky')
})

app.listen(port, () => {
  console.log(`Summer Camp is sitting on port ${port}`);
})