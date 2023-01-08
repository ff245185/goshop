const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET)

const port = process.env.PORT || 5000;
const app = express();

// middleware 
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.USER}:${process.env.PASSWORD}@cluster0.ikwqeh8.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


// verify jwt token

function verifyJWT(req, res, next) {
  const userAuth = req.headers?.authorization;
  if (!userAuth) {
    return res.status(401).send('Unauthorized Access')
  }
  const token = userAuth.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, (
    err, decoded) => {
    if (err) {
      return res.status(403).send({ message: 'forbidden Access' })
    }
    req.decoded = decoded;
    next();
  })

}






async function run() {
  try {
    const categoryCollection = client.db('pirates-hut').collection('products-category');
    const productsCollection = client.db('pirates-hut').collection('products');
    const bookedItemCollection = client.db('pirates-hut').collection('booked-items');
    const userCollection = client.db('pirates-hut').collection('users');
    const advertiseCollection = client.db('pirates-hut').collection('advertiseitem');
    const wishlistCollection = client.db('pirates-hut').collection('wishlist');
    const paymentsCollection = client.db('pirates-hut').collection('payments');
    //  post booked item

    app.post('/bookItem', async (req, res) => {
      const item = req.body;
      const result = await bookedItemCollection.insertOne(item);
      res.send(result)

    })

    // add new products

    app.post('/addproducts', async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      res.send(result)

    })





    // get my products

    app.get('/myproducts', async (req, res) => {
      const email = req.query?.email;
      const query = {
        email: email
      }

      const result = productsCollection.find(query);
      const myproducts = await result.toArray();
      res.send(myproducts)
    })






    //   add to advertise

    app.put('/addtoadvertise', async (req, res) => {
      const advertiseItem = req.body;
      const id = req.query.id;
      const filter = {
        _id: ObjectId(id)
      }
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          category: advertiseItem.category,
          location: advertiseItem.location,
          phone: advertiseItem.phone,
          price: advertiseItem.price,
          title: advertiseItem.title,
          description: advertiseItem.description,
          email: advertiseItem.email,
          purchaseyear: advertiseItem.purchaseyear,
          originalprice: advertiseItem.originalprice,
          condition: advertiseItem.condition,
          postdate: advertiseItem.postdate,
          price: advertiseItem.price,
          availibility: advertiseItem.availibility,
          advertise: 'advertised',
          image: advertiseItem.image
        }
      }
      const result = await advertiseCollection.updateOne(filter, updatedDoc, options);
      res.send(result);
    })


    // get all adertised items 
    app.get('/advertisedItem', async (req, res) => {
      const query = {
        advertise: 'advertised'
      }
      const items = await advertiseCollection.find(query).toArray();
      res.send(items)
    })




    // google user login

    app.put('/googlelogin', async (req, res) => {
      let user = req.body;
      const filter = {
        email: user?.email
      }
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          name: user.name,
          email: user?.email,
          photoURL: user?.photoURL,
          accountType: 'Buyer'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc, options)
      res.send(result)


    })











    // create user
    app.post('/createuser', async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.send(result);
    })



    // get jwt token 
    app.get('/getjwt', async (req, res) => {
      const email = req.query?.email;
      const query = {
        email: email
      };
      const user = await userCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1d' })
        return res.send({ accessToken: token })
      }
      res.status(403).send({ accessToken: '' });

    })










    // get my orders
    app.get('/myorders', verifyJWT, async (req, res) => {
      const email = req.query?.email;
      const decodedEmail = req.decoded?.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ message: 'forbidden Access' })
      }
      const query = {
        email: email
      }
      const result = await bookedItemCollection.find(query).toArray();


      res.send(result);
    })


    // get  users  
    app.get('/users', async (req, res) => {
      const email = req.query?.email;
      if (email) {
        const query = {
          email: email
        }
        const user = await userCollection.find(query).toArray();
        return res.send(user)
      }
      res.send({ message: 'No Email Found' })
    })

    // get all users

    app.get('/allusers', verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const adminemail = { email: decodedEmail };
      const user = await userCollection.findOne(adminemail);
      if (user?.accountType !== 'Admin') {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const query = {};
      const allusers = await userCollection.find(query).toArray();
      res.send(allusers);
    })

    // use admin hook
    app.get('/users/admin/:email', async (req, res) => {
      const email = req.params?.email;
      const query = { email: email }
      const user = await userCollection.findOne(query);
      res.send({ isAdmin: user?.accountType === 'Admin' });
    })

    // use seller verify
    app.get('/users/seller/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      res.send({ isSeller: user?.accountType === 'Seller' });
    })


    //  get all sellers 
    app.get('/allseller', verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const adminemail = { email: decodedEmail };
      const user = await userCollection.findOne(adminemail);
      if (user?.accountType !== 'Admin') {
        return res.status(403).send({ message: 'forbidden access' });
      }

      const query = {
        accountType: 'Seller'
      };
      const sellers = await userCollection.find(query).toArray();
      res.send(sellers)
    })

    // promote user 
    app.patch('/setaccounttype/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) }
      const updatedDoc = {
        $set: {
          accountType: 'Admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })




    //  verify seller
    app.put('/verifyuser/:id', async (req, res) => {
      const id = req.params.id;
      const filter = {
        _id: ObjectId(id)
      }
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          verification: 'Verified'
        }
      }
      // const user = userCollection.find(filter);
      const result = await userCollection.updateOne(filter, updatedDoc, options)
      res.send(result)
    })

    // verify sellerproducts
    app.put('/verifyuserproducts/:email', async (req, res) => {
      const email = req.params.email;
      const filter = {
        email: email
      }
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          verification: 'Verified'
        }
      }
      const result = await productsCollection.updateOne(filter, updatedDoc, options);
      res.send(result)
    })
    //add to wishlist
    app.put('/addtowishlist', async (req, res) => {
      const product = req.body;
      console.log(req.body);
      const id = product._id;
      const filter = {
        _id: ObjectId(id)
      }
      const options = { upsert: true }
      const updatedDoc = {
        $set: {
          category: product.category,
          location: product.location,
          phone: product.phone,
          price: product.price,
          title: product.title,
          sellername: product.sellername,
          description: product.description,
          purchaseyear: product.purchaseyear,
          originalprice: product.originalprice,
          productId: product._id,
          email: product.buyeremail

        }
      }

      const result = await wishlistCollection.updateOne(filter, updatedDoc, options);
      res.send(result)
    })



    // get all wishlis

    app.get('/wishlistitems/:email', async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const query = {
        email: email
      }
      const result = await wishlistCollection.find(query).toArray();
      res.send(result)
    })

    // delete wishlist
    app.delete('/deletewishlist/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: ObjectId(id)
      }
      console.log(query);
      const result = await wishlistCollection.deleteOne(query);
      res.send(result)
    })




    // get all buyers
    app.get('/allbuyers', verifyJWT, async (req, res) => {

      const decodedEmail = req.decoded.email;
      const adminemail = { email: decodedEmail };
      const user = await userCollection.findOne(adminemail);
      if (user?.accountType !== 'Admin') {
        return res.status(403).send({ message: 'forbidden access' });
      }

      const query = {
        accountType: 'Buyer'
      };
      const buyers = await userCollection.find(query).toArray();
      res.send(buyers)
    })


    //  delete seller
    app.delete('/deleteseller/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) }
      const result = await userCollection.deleteOne(filter);
      res.send(result);
    })

    // delete  buyer
    app.delete('/deletebuyer/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) }
      const result = await userCollection.deleteOne(filter);
      res.send(result);
    })

    // delete users 
    app.delete('/deleteuser/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: ObjectId(id) }
      const result = await userCollection.deleteOne(filter);
      res.send(result)
    })


    // delete my orders 
    app.delete('/deleteorder/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: ObjectId(id) }
      const result = await bookedItemCollection.deleteOne(filter);
      res.send(result)
    })


    // delete product

    app.delete('/deletemyproduct/:id', async (req, res) => {
      const id = req.params.id;

      const filter = { _id: ObjectId(id) };
      const result = await productsCollection.deleteOne(filter);
      res.send(result)
    })

    // delete adveriseprduct

    app.delete('/deleteadvertiseproduct/:email', async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await advertiseCollection.deleteOne(filter);
      res.send(result)
    })


    //  get categories 
    app.get('/categories', async (req, res) => {
      const query = {}
      const category = await categoryCollection.find(query).toArray();
      res.send(category);

    })

    //  get selected category item
    app.get('/category/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) }
      const categoryItems = await categoryCollection.findOne(query);
      res.send(categoryItems)
    })


    //  get products by category

    app.get('/products/:category', async (req, res) => {
      const category = req.params.category;
      const query = {
        category: category
      }
      const products = await productsCollection.find(query).toArray();
      const matchedData = products.filter(payment => {
        return payment.paymentStatus !== true;
      })
      res.send(matchedData)
    })



    // getcheckout item
    app.get('/dashboard/checkout/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        productId: id
      }
      const result = await bookedItemCollection.find(query).toArray();

      res.send(result)
    })


    // checkout

    app.post('/create-payment-intent', async (req, res) => {
      const booking = req.body;
      const price = booking.price;
      const amount = price * 100;


      const paymentIntent = await stripe.paymentIntents.create({
        currency: 'usd',
        amount: amount,
        'payment_method_types': [
          'card'
        ]
      })
      res.send({
        clientSecret: paymentIntent.client_secret
      })

    })


    // payments
    app.put('/payments', async (req, res) => {
      const payment = req.body;

      const id = payment.productId;
      const filter = { _id: ObjectId(id) }
      const options = { upsert: true }
      const bookedfilter = { productId: id }
      const updatedDoc = {
        $set: {
          paymentStatus: true,
          transactionId: payment.transactionId
        }
      }
      const result = await paymentsCollection.updateOne(filter, updatedDoc, options);

      const updatedResult = await bookedItemCollection.updateOne(bookedfilter, updatedDoc)
      const updateProduct = {
        $set: {
          paymentStatus: true
        }
      }
      const updatedProducts = await productsCollection.updateOne(filter, updateProduct, options)

      res.send(result);
    })





  } finally { }

}


run()




app.get('/', async (req, res) => {
  res.send('Pirates Hut Server Is running')
})

app.listen(port, () => 'Pirates Hut server is running')