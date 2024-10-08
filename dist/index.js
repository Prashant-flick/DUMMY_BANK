"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const axios_1 = __importDefault(require("axios"));
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: "*"
}));
app.use(express_1.default.json());
app.use(body_parser_1.default.urlencoded({ extended: false }));
const client = new client_1.PrismaClient();
app.set('view engine', 'ejs');
app.get('/HDFC/addMoneyToWallet', (req, res) => {
    res.render('pages/index.ejs');
});
app.get('/HDFC/createAccount', (req, res) => {
    res.render('pages/createAccount.ejs');
});
app.get('/HDFC/addMoneyToAccount', (req, res) => {
    res.render('pages/addMoneyToAcc');
});
app.post('/HDFC/createAccount', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password, amount, number } = req.body;
    if (!email || !password || !amount) {
        res.status(400)
            .json({
            message: "all feilds are required"
        });
    }
    else {
        if (amount < 500) {
            res.status(300)
                .json({
                message: "min 500 req"
            });
        }
        else {
            const hashPassword = yield bcrypt_1.default.hash(password, 10);
            const bank = yield client.bank.findFirst({
                where: {
                    id: 1
                }
            });
            const bankBalance = (bank === null || bank === void 0 ? void 0 : bank.balance) || 0;
            if (bankBalance >= amount * 100) {
                const transaction = yield client.$transaction([
                    client.user.create({
                        data: {
                            email: email,
                            password: hashPassword,
                            balance: Number(amount) * 100,
                            number: number
                        }
                    }),
                    client.bank.update({
                        where: {
                            id: 1
                        },
                        data: {
                            balance: {
                                decrement: Number(amount) * 100
                            }
                        }
                    })
                ]);
                if (transaction && transaction.length > 0) {
                    res.status(200)
                        .json({
                        message: "user created successfully"
                    });
                }
                else {
                    res.status(400)
                        .json({
                        message: "user Creation failed"
                    });
                }
            }
            else {
                res.status(300)
                    .json({
                    message: "dont have enough money in bank"
                });
            }
        }
    }
}));
app.post('/HDFC/addMoneyToWallet', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    const token = String(req.query.token) || "";
    const PaytmUserId = String(req.query.userId) || "";
    const amount1 = String(req.query.amount) || "";
    const amount = Number(amount1);
    if (!email || !password || !amount || !token || !PaytmUserId) {
        res.status(400)
            .json({
            message: "all feilds are required"
        });
    }
    else {
        const user = yield client.user.findFirst({
            where: {
                email: email
            }
        });
        if (!user) {
            res.status(400)
                .json({
                message: "user doesn't exist"
            });
        }
        else {
            const verifyPassword = yield bcrypt_1.default.compare(password, user.password);
            if (verifyPassword) {
                const userBalace = user === null || user === void 0 ? void 0 : user.balance;
                if (userBalace >= amount) {
                    const transaction = yield client.$transaction([
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
                    ]);
                    if (transaction) {
                        const webHook = yield axios_1.default.post('https://bank-webhook.jackbythehedge.co.uk/hdfcWebHook', {
                            token: token,
                            user_identifier: transaction[0].userIdPaytm,
                            amount: amount
                        });
                        if (webHook) {
                            yield client.transaction.update({
                                where: {
                                    id: transaction[0].id
                                },
                                data: {
                                    status: "Success"
                                }
                            });
                            res.status(200)
                                .json({
                                message: "transaction successfull",
                                redirectUrl: "http://user1.jackbythehedge.co.uk/transfer",
                            });
                        }
                        else {
                            res.status(400)
                                .json({
                                message: "webHook post failed"
                            });
                        }
                    }
                    else {
                        res.status(400)
                            .json({
                            message: "transaction failed"
                        });
                    }
                }
                else {
                    res.status(400)
                        .json({
                        message: "low Balance"
                    });
                }
            }
            else {
                res.status(400)
                    .json({
                    message: "invalid Password"
                });
            }
        }
    }
}));
app.post('/HDFC/addMoneyToAccount', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password, amount } = req.body;
    if (!email || !password || !amount) {
        res.status(400)
            .json({
            message: "all feilds are required"
        });
    }
    else {
        const user = yield client.user.findFirst({
            where: {
                email: email
            }
        });
        if (!user) {
            res.status(400)
                .json({
                message: "user doesn't exist"
            });
        }
        else {
            const verifyPassword = yield bcrypt_1.default.compare(password, user.password);
            if (verifyPassword) {
                const bank = yield client.bank.findFirst({
                    where: {
                        id: 1
                    }
                });
                if (!bank || (bank === null || bank === void 0 ? void 0 : bank.balance) < (amount * 100)) {
                    res.status(400)
                        .json({
                        message: "insufficient bank balance"
                    });
                }
                const transaction = yield client.$transaction([
                    client.bank.update({
                        where: {
                            id: 1
                        },
                        data: {
                            balance: {
                                decrement: Number(amount) * 100
                            }
                        }
                    }),
                    client.user.update({
                        where: {
                            email: email
                        },
                        data: {
                            balance: {
                                increment: Number(amount) * 100
                            }
                        }
                    })
                ]);
                if (transaction) {
                    res.status(200)
                        .json({
                        message: "success"
                    });
                }
                else {
                    res.status(400)
                        .json({
                        message: "Upadating amount failed"
                    });
                }
            }
            else {
                res.status(400)
                    .json({
                    message: "invalid Password"
                });
            }
        }
    }
}));
app.listen(3004, () => {
    console.log("app is runnig on port 3004");
});
