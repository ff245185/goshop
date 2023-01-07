const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);




app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
	res.send("furniture server is running now ");
});
app.listen(port, () => {
	console.log("port is running", port);
});
const uri = `mongodb+srv://${process.env.USER}:${process.env.PASSWORD}@cluster0.jf2skzr.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri)
const client = new MongoClient(uri, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
	serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
	const authHeader = req.headers.authorization
	if (!authHeader) {
		return res.status(401).send('unAuthorized')
	}
	const token = authHeader.split(' ')[1]
	jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
		if (err) {
			return res.status(403).send({ message: "forbidden access" })
		}
		req.decoded = decoded
		next()
	})
}

async function run() {
	const reshop1000s = client.db('reshop1000').collection('function')
	const gatagroisCollections = client.db('reshop1000').collection('gatagrois')
	const userCollections = client.db('reshop1000').collection('user')
	const orserCollections = client.db('reshop1000').collection('orser')
	const reportCollections = client.db('reshop1000').collection('report')
	const paymentCollection = client.db('reshop1000').collection('payment')


	// verify admin 
	const verifyAdmin = async (req, res, next) => {
		const decodedEmail = req.decoded.email
		const query = { email: decodedEmail }
		const user = await userCollections.findOne(query)

		if (user?.role !== 'Admin') {
			return res.status(403).send({ message: 'forbidden access' })
		}
		next()
	}
	// verify seller 
	const verifySeller = async (req, res, next) => {
		const decodedEmail = req.decoded.email
		const query = { email: decodedEmail }
		const user = await userCollections.findOne(query)

		if (user?.role !== 'seller') {
			return res.status(403).send({ message: 'forbidden access' })
		}
		next()
	}
	// verify buyer 
	const verifyBuyer = async (req, res, next) => {
		const decodedEmail = req.decoded.email
		const query = { email: decodedEmail }
		const user = await userCollections.findOne(query)

		if (user?.role !== 'buyer') {
			return res.status(403).send({ message: 'forbidden access' })
		}
		next()
	}
	try {

		app.post("/create-payment-intent", async (req, res) => {
			const order = req.body;
			
			const price = order.price;
			const amount = price * 100;
			
			const paymentIntent = await stripe.paymentIntents.create({
				currency: "usd",
				amount: amount,
				payment_method_types: ["card"],
			});
			res.send({
				clientSecret: paymentIntent.client_secret,
			});
		});


		app.post("/payment", async (req, res) => {
			const payment = req.body;
			const result = await paymentCollection.insertOne(payment);
			const id = payment.order;
			const filter = { _id: ObjectId(id) };
			const updatedDoc = {
				$set: {
					paid: true,
					transactionId: payment.transactionId,
				},
			};
			const updatedResult = await orserCollections.updateOne(
				filter,
				updatedDoc
			);
			res.send(result);
		});



		




		app.post('/orser', async (req, res) => {
			const checkSellerEmail = req.query.email
			const order = req.body
			const query = {
				productId: order.productId,
				productImage: order.productImage
			}
			const checkSeller = { sellerEmail: order?.buyerEmail }
			const seller = await reshop1000s.findOne(checkSeller)
			if (checkSellerEmail === seller?.sellerEmail) {
				return res.send({ message: "You can't order your product" })
			}
			const alreadyOrder = await orserCollections.findOne(query)
			if (alreadyOrder) {
				return res.send({ message: 'Sorry this product is out of stock' })
			}
			const result = await orserCollections.insertOne(order)
			res.send(result)
		})




		app.post('/function', async (req, res) => {
			const product = req.body
			const result = await reshop1000s.insertOne(product)
			res.send(result)
		})
		app.post('/user', async (req, res) => {
			const user = req.body
			const query = { email: user.email }
			const alreadyUser = await userCollections.findOne(query)
			if (alreadyUser) {
				return res.send({ acknowledged: true })
			}
			const result = await userCollections.insertOne(user)
			res.send(result)

		})
		app.post('/report', async (req, res) => {
			const report = req.body
			const result = await reportCollections.insertOne(report)
			res.send(result)
		})
		
		app.get('/jwt', async (req, res) => {
			const email = req.query.email;
			const query = { email: email };
			const user = await userCollections.findOne(query);
			if (user) {
				const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5d' })
				return res.send({ accessToken: token });
			}
			res.status(403).send({ accessToken: '' })
		});

		app.get('/user/admin/:email', async (req, res) => {
			const email = req.params.email;
			const query = { email }
			const user = await userCollections.findOne(query);
			res.send({ isAdmin: user?.role === 'Admin' });
		})
		app.get('/user', verifyJWT, verifyAdmin, async (req, res) => {
			const email = req.query.email;
			const decodedEmail = req.decoded.email;
			if (email !== decodedEmail) {
				return res.status(403).send({ message: 'forbidden access' });
			}
			const result = await userCollections.find({}).toArray()
			res.send(result)
		})
		app.get('/user/sellers', verifyJWT, verifyAdmin, async (req, res) => {
			const email = req.query.email;
			const decodedEmail = req.decoded.email;
			if (email !== decodedEmail) {
				return res.status(403).send({ message: 'forbidden access' });
			}
			const sellers = await userCollections.find({}).toArray()
			const seller = sellers.filter(seller => seller.role === 'seller')
			res.send(seller)
		})
		app.get('/user/buyers', verifyJWT, verifyAdmin, async (req, res) => {
			const email = req.query.email;
			const decodedEmail = req.decoded.email;
			if (email !== decodedEmail) {
				return res.status(403).send({ message: 'forbidden access' });
			}
			const sellers = await userCollections.find({}).toArray()
			const seller = sellers.filter(seller => seller.role === 'buyer')
			res.send(seller)
		})

		app.get('/user/:email', verifyJWT, async (req, res) => {
			const email = req.params.email
			const query = { email: email }
			const result = await userCollections.findOne(query)
			res.send(result)
		})
		app.get('/user/seller/:email', async (req, res) => {
			const email = req.params.email;
			const query = { email }
			const user = await userCollections.findOne(query);
			res.send({ isSeller: user?.role === 'seller' });
		})
		app.get('/user/buyer/:email', async (req, res) => {
			const email = req.params.email;
			const query = { email }
			const user = await userCollections.findOne(query);
			res.send({ isBuyer: user?.role === 'buyer' });
		})

		app.get('/gatagrois', async (req, res) => {
			const query = {}
			const result = await gatagroisCollections.find(query).toArray()
			res.send(result)
		})
		app.get("/avtar", async (req, res) => {
			const query = {}
			const result = await reshop1000s.find(query).toArray()
			res.send(result)
		})
		app.get('/avtar/:id', async (req, res) => {
			const { id } = req.params
			const query = { _id: ObjectId(id) }
			const result = await reshop1000s.findOne(query)
			res.send(result)
		})
		app.get('/avtar/seller/:email', verifyJWT, verifySeller, async (req, res) => {
			const email = req.params.email
			const query = { sellerEmail: email }
			const result = await reshop1000s.find(query).toArray()
			res.send(result)
		})
		app.get('/advertisefunction', async (req, res) => {
			const avtar = await reshop1000s.find({}).toArray()
			const filter = avtar.filter(furniture => furniture.Status === 'Approved')
			res.send(filter)
		})
		app.get('/gatagroisProducts/:id', async (req, res) => {
			const { id } = req.params
			const query = { categoryName: id }
			const result = await reshop1000s.find(query).toArray()
			res.send(result)
		})
		app.get('/orser/:email', verifyJWT, async (req, res) => {
			const email = req.params.email
			const query = { buyerEmail: email }
			const result = await orserCollections.find(query).toArray()
			res.send(result)
		})
		app.get('/singleOrder/:id', async (req, res) => {
			const id = req.params.id
			const query = { _id: ObjectId(id) }
			const result = await orserCollections.findOne(query)
			res.send(result)
		})
		app.get('/report', verifyJWT, verifyAdmin, async (req, res) => {
			const query = {}
			const result = await reportCollections.find(query).toArray()
			res.send(result)
		})

		
		app.put('/user/:email', verifyJWT, verifyAdmin, async (req, res) => {
			const email = req.params.email
			if (email) {
				const sellerVerified = { email: email }
				const query = { sellerEmail: email }
				const options = { upsert: true }
				const updateDoc = {
					$set: {
						verified: 'true',
					}
				}
				const seller = await userCollections.updateOne(sellerVerified, updateDoc, options)
				const result = await reshop1000s.updateMany(query, updateDoc, options)
				res.send(result)
			}
		})
		app.put('/function/:id', async (req, res) => {
			const { id } = req.params
			const Status = req.body
			const query = { _id: ObjectId(id) }
			const options = { upsert: true }
			const updateDoc = {
				$set: {
					Status: Status?.Status,
				}
			}
			const result = await reshop1000s.updateOne(query, updateDoc, options)
			res.send(result)
		})


		app.delete('/user/:id', verifyJWT, verifyAdmin, async (req, res) => {
			const { id } = req.params
			const email = req.query.email
			const query = { _id: ObjectId(id) }
			const user = await userCollections.findOne(query)
			if (user.email === email || user.role === 'Admin' || user.email === 'jibon@gmail.com') {
				return res.send({ message: "You Can't delete admin but Owner Can delete everything" })
			}
			const result = await userCollections.deleteOne(query)
			res.send(result)
		})
		app.delete('/function/:id', verifyJWT, verifyAdmin, async (req, res) => {
			const id = req.params.id
			const query = { _id: ObjectId(id) }
			const result = await reshop1000s.deleteOne(query)
			res.send(result)
		})
		app.delete('/function/seller/:id', verifyJWT, verifySeller, async (req, res) => {
			const { id } = req.params
			const query = { _id: ObjectId(id) }
			const result = await reshop1000s.deleteOne(query)
			res.send(result)
		})
		app.delete('/orser/:id', verifyJWT, async (req, res) => {
			const { id } = req.params
			const query = { _id: ObjectId(id) }
			const result = await orserCollections.deleteOne(query)
			res.send(result)
		})
		app.delete('/report/:id', verifyJWT, verifyAdmin, async (req, res) => {
			const { id } = req.params
			const query = { _id: ObjectId(id) }
			const result = await reportCollections.deleteOne(query)
			res.send(result)
		})
		
	} finally {
		err => {
			console.log(err);
		}
	}
}
run().catch(err => {
	console.log(err);
});
