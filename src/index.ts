    import express from "express"
    import bodyParser from "body-parser";
    import { PrismaClient} from "@prisma/client"
    import bcrypt from "bcrypt"
    import axios from "axios"

    const app = express()
    app.use(express.json())
    app.use(bodyParser.urlencoded({ extended: false }));
    const client = new PrismaClient()

    app.set('view engine', 'ejs');

    app.get('/HDFC/addMoneyToWallet', (req,res)=>{
        res.render('pages/index.ejs')
    })

    app.get('/HDFC/createAccount', (req,res)=> {
        res.render('pages/createAccount.ejs')
    })

    app.get('/HDFC/addMoneyToAccount', (req, res) => {
        res.render('pages/addMoneyToAcc')
    })

    app.post('/HDFC/createAccount', async(req, res)=> {
        const {email, password, amount, number}:{email: string, password: string, amount: number, number: string} = req.body
        
        if(!email || !password || !amount){
            res.status(400)
            .json({
                message: "all feilds are required"
            })
            
        }else{
            if(amount<500){
                res.status(300)
                .json({
                    message: "min 500 req"
                })
            }else{
                const hashPassword = await bcrypt.hash(password, 10);

                const bank = await client.bank.findFirst({
                    where: {
                        id: 1
                    }
                })                

                const bankBalance = bank?.balance || 0
                if(bankBalance>=amount*100){
                    const transaction = await client.$transaction([
                        client.user.create({
                            data: {
                                email: email,
                                password: hashPassword,
                                balance: Number(amount)*100,
                                number: number
                            }
                        }),
                        client.bank.update({
                            where:{
                                id: 1
                            },
                            data: {
                                balance: {
                                    decrement: Number(amount)*100
                                }
                            }
                        })
                    ])
                    
                    if(transaction && transaction.length>0){
                        res.status(200)
                        .json({
                            message: "user created successfully"
                        })
                    }else{
                        res.status(400)
                        .json({
                            message: "user Creation failed"
                        })
                    }
                }else{
                    res.status(300)
                    .json({
                        message: "dont have enough money in bank"
                    })
                }
            }
        }
    })

    app.post('/HDFC/addMoneyToWallet', async(req, res)=> {
        const {email, password}: {email: string, password: string} = req.body
        const token: string = String(req.query.token) || ""
        const PaytmUserId: string = String(req.query.userId) || ""
        const amount1:string = String(req.query.amount) || ""
        const amount:number = Number(amount1)
        
        if(!email || !password || !amount  || !token || !PaytmUserId){
            res.status(400)
            .json({
                message: "all feilds are required"
            })
            
        }else{
            const user = await client.user.findFirst({
                where:{
                    email: email
                }
            })

            if(!user){
                res.status(400)
                .json({
                    message: "user doesn't exist"
                })
            }else{
                const verifyPassword = await bcrypt.compare(password, user.password)
                if(verifyPassword){
                    const userBalace = user?.balance
                    if(userBalace>=amount){
                        const transaction = await client.$transaction([
                            client.transaction.create({
                                data: {
                                    userIdbank: user.id,
                                    token: token,
                                    status: "Processing",
                                    amount: amount,
                                    userIdPaytm: Number(PaytmUserId)
                                }
                            }),
                            client.user.update({
                                where: {
                                    id: user.id
                                },
                                data: {
                                    balance: {
                                        decrement: amount
                                    }
                                }
                            })
                        ])
                        if(transaction){
                            const webHook = await axios.post('http://localhost:3003/hdfcWebHook', {
                                token: token,
                                user_identifier: transaction[0].userIdPaytm,
                                amount: amount
                            })

                            if(webHook){
                                await client.transaction.update({
                                    where: {
                                        id: transaction[0].id
                                    },
                                    data: {
                                        status: "Success"
                                    }
                                })

                                res.status(200)
                                .json({
                                    message: "transaction successfull",
                                    redirectUrl: "http://localhost:3001/transfer",
                                })

                            }else{
                                res.status(400)
                                .json({
                                    message: "webHook post failed"
                                })
                            }
                        }else{
                            res.status(400)
                            .json({
                                message: "transaction failed"
                            })
                        }
                    }else{
                        res.status(400)
                        .json({
                            message: "low Balance"
                        })
                    }
                }else{
                    res.status(400)
                    .json({
                        message: "invalid Password"
                    })
                }
            }

        }
    })

    app.post('/HDFC/addMoneyToAccount', async(req, res) => {
        const { email, password, amount}:{email: string, password: string, amount: number} = req.body

        if(!email || !password || !amount){
            res.status(400)
            .json({
                message: "all feilds are required"
            })
            
        }else{
            const user = await client.user.findFirst({
                where:{
                    email: email
                }
            })

            if(!user){
                res.status(400)
                .json({
                    message: "user doesn't exist"
                })
            }else{
                const verifyPassword = await bcrypt.compare(password, user.password)
                if(verifyPassword){
                    const bank = await client.bank.findFirst({
                        where: {
                            id: 1
                        }
                    })

                    if(!bank || bank?.balance<(amount*100)){
                        res.status(400)
                        .json({
                            message: "insufficient bank balance"
                        })
                    }

                    const transaction = await client.$transaction([
                        client.bank.update({
                            where:{
                                id: 1
                            },
                            data: {
                                balance: {
                                    decrement: Number(amount)*100
                                }
                            }
                        }),
                        client.user.update({
                            where: {
                                email: email
                            },
                            data: {
                                balance: {
                                    increment: Number(amount)*100
                                }
                            }
                        })
                    ])
                    
                    if(transaction){
                        res.status(200)
                        .json({
                            message: "success"
                        })
                    }else{
                        res.status(400)
                        .json({
                            message: "Upadating amount failed"
                        })
                    }
                }else{
                    res.status(400)
                    .json({
                        message: "invalid Password"
                    })
                }
            }
        }
    })


    app.listen(3004, ()=>{
        console.log("app is runnig on port 3004");
    })