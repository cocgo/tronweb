const axios = require('axios');
const express = require("express");
const bodyParser = require("body-parser");
const tools = require("tron-http-tools");
const RpcClient = require("./rpcclient");


const {getBase58CheckAddress} = require('tron-http-tools/utils/crypto');

const assetCache = {};

function hex2a(hexx) {
    const hex = hexx.toString();//force conversion
    let str = '';
    for (let i = 0; (i < hex.length && hex.substr(i, 2) !== '00'); i += 2)
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    return str;
}

async function getAsset(id) {
    if (assetCache[id])
        return assetCache[id];

    console.log('fetching asset list');
    const assetList = await axios.get('https://api.trongrid.io/walletsolidity/getassetissuelist').then(x => x.data);
    assetList.assetIssue.forEach(a => {
        assetCache[a.id] = {
            ...a,
            name: hex2a(a.name)
        };
    });

    return assetCache[id];
}

module.exports = class {

    constructor(config, db) {
        this.db = db;

        console.log(`Starting http server on port ${config.port}`);
        let dd_options = {
            'response_code': true,
            'tags': ['app:tron-http-server']
        };
        let connect_datadog = require('connect-datadog')(dd_options);

        let rpc = new RpcClient(config);
        let app = express();
        this.rpc = rpc;
        app.use(bodyParser.urlencoded({extended: true}));
        app.use(connect_datadog);

        app.get('/', async (req, res) => {
            res.set({'Content-Type': 'application/json; charset=utf-8'});

            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "X-Requested-With");

            res.send(JSON.stringify({
                grpc: {
                    methods: {
                        "grpc/listWitnesses": {
                            type: "GET"
                        },
                        "grpc/getAccount": {
                            type: "GET",
                            parameters: {
                                address: "base58 encoded Tron address"
                            }
                        },
                        "grpc/getTransactionsToThis": {
                            type: "GET",
                            parameters: {
                                address: "base58 encoded Tron address"
                            }
                        },
                        "grpc/getTransactionsFromThis": {
                            type: "GET",
                            parameters: {
                                address: "base58 encoded Tron address"
                            }
                        },
                        "grpc/broadcastTransaction": {
                            type: "POST",
                            parameters: {
                                transaction: "base64 encoded serialized Transaction protobuf"
                            }
                        },
                        "grpc/getLastBlock": {
                            type: "GET"
                        }
                    }
                },

                api: {
                    methods: {
                        "getContractsFrom": {
                            type: "GET",
                            parameters: {
                                address: "base58 encoded TRON address"
                            }
                        },
                        "getTransactionsFromThis": {
                            type: "GET",
                            parameters: {
                                address: "base58 encoded TRON address"
                            }
                        },
                        "getTransactionsToThis": {
                            type: "GET",
                            parameters: {
                                address: "base58 encoded TRON address"
                            }
                        },
                        "getAccount": {
                            type: "GET",
                            parameters: {
                                address: "base58 encoded TRON address"
                            }
                        },
                        "getTokens": {
                            type: "GET"
                        }


                    }
                }
            }, null, 2));
        });

        /*********************************************
         * ***************** GRPC ********************
         ********************************************/

        app.get('/grpc/getLastBlock', async (req, res) => {
            try {
                let blockProto = await rpc.getNowBlock().catch(x => null);
                let serializedBase64 = tools.utils.base64EncodeToString(blockProto.serializeBinary());
                res.send(serializedBase64);
            } catch (e) {
                res.send(null);
            }
        });

        app.get('/grpc/listWitnesses', async (req, res) => {
            try {
                let witnessesProto = await rpc.listWitnesses().catch(x => null);
                let serializedBase64 = tools.utils.base64EncodeToString(witnessesProto.serializeBinary());
                res.send(serializedBase64);
            } catch (e) {
                res.send(null);
            }
        });

        app.get('/grpc/getAccount', async (req, res) => {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "X-Requested-With");
            try {
                let accountRaw = await rpc.getAccount(req.query.address).catch(x => null);
                let serializedBase64 = tools.utils.base64EncodeToString(accountRaw.serializeBinary());
                res.send(serializedBase64);
            } catch (e) {
                res.send(null);
            }
        });

        app.get('/grpc/getTransactionsToThis', async (req, res) => {
            try {
                let transactionsRaw = await rpc.getTransactionsToThis(req.query.address).catch(x => null);
                let serializedBase64 = tools.utils.base64EncodeToString(transactionsRaw.serializeBinary());
                res.send(serializedBase64);
            } catch (e) {
                res.send(null);
            }
        });

        app.get('/grpc/getTransactionsFromThis', async (req, res) => {
            try {
                let transactionsRaw = await rpc.getTransactionsFromThis(req.query.address).catch(x => null);
                let serializedBase64 = tools.utils.base64EncodeToString(transactionsRaw.serializeBinary());
                res.send(serializedBase64);
            } catch (e) {
                res.send(null);
            }
        });

        app.post('/grpc/broadcastTransaction', async (req, res) => {
            try {
                let responseRaw = await rpc.broadcastBase64EncodedTransaction(req.body.transaction).catch(x => null);
                let serializedBase64 = tools.utils.base64EncodeToString(responseRaw.serializeBinary());
                res.send(serializedBase64);
            } catch (e) {
                res.send(null);
            }
        });

        /*********************************************
         ************ API USING OUR DB ***************
         ********************************************/

        app.get('/witnesses', async (req, res) => {
            try {
                let witnessesProto = await rpc.listWitnesses().catch(x => null);
                let output = [];
                let witnesses = witnessesProto.getWitnessesList();
                for (let i in witnesses) {
                    let witness = witnesses[i];
                    let witnessObject = witness.toObject();
                    let ownerAddress = getBase58CheckAddress(Array.from(witness.getAddress()));
                    witnessObject.address = ownerAddress;
                    witnessObject.ownerAccount = await this.getFullAccount(ownerAddress).catch(x => null);
                    output.push(witnessObject);
                }
                res.send(output);
            } catch (e) {
                console.log(e);
                res.send(null);
            }
        });

        app.get('/getLastBlock', async (req, res) => {
            let lastBlock = await this.db.getLastBlock().catch(x => null);
            res.send(lastBlock);
        });

        app.get('/getAccount', async (req, res) => {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "X-Requested-With");
            let account = await this.getFullAccount(req.query.address).catch(x => null);
            res.send(account);
        });

        app.get('/getAccountByName', async (req, res) => {
            let account = await this.db.getAccountByName(req.query.name).catch(x => null);
            if (account == null)
                res.status(404);
            res.send(account);
        });

        app.get('/getAccounts', async (req, res) => {
            let addresses = req.query.addresses.split(",");
            let accounts = {};
            for (let i = 0; i < addresses.length; i++) {
                accounts[addresses[i]] = await this.getFullAccount(addresses[i]).catch(x => null);
            }
            res.send(accounts);
        });

        app.get('/getTransactionsRelatedToThis', async (req, res) => {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "X-Requested-With");
            let transactions = await this.db.getContractsRelatedToThis(req.query.address).catch(x => null);
            if (req.query.start) {
                let start = parseInt(req.query.start);
                for (let i = transactions.length - 1; i >= 0; i--) {
                    if (parseInt(transactions[i].timestamp) < start) {
                        transactions.splice(i, 1);
                    }

                }
            }
            if (req.query.end) {
                let end = parseInt(req.query.end);
                for (let i = transactions.length - 1; i >= 0; i--) {
                    if (transactions[i].timestamp > end)
                        transactions.splice(i, 1);
                }
            }
            res.send(transactions);
        });

        app.get('/getTokens', async (req, res) => {
            let tokens = await this.db.getTokens(req.query.buys).catch(x => null);
            res.send(tokens);
        });


        app.listen(config.port);
    }

    async getNewTokens(address) {
        // const account = await axios.get('https://api.trongrid.io/wallet/getaccount?address=' + tronWeb.address.toHex(address)).then(x => x.data);
        // const tokens = {};
        // if (account && account.assetV2) {
        //     for (let i = 0; i < account.assetV2.length; i++) {
        //         const a = account.assetV2[i];
        //         const asset = await getAsset(a.key);
        //         tokens[a.key] = {
        //             ...asset,
        //             amount: a.value
        //         };
        //     }
        //     return tokens;
        // }
        return '';
    }

    async getFullAccount(address) {
        //let account = await this.db.getAccount(address).catch(x => null);

        let account = {
            address
        };

        try {
            if (account) {
                let accountRaw = await this.rpc.getAccount(address);
                let accountNet = await this.rpc.getAccountNet(address);
                accountRaw = accountRaw.toObject();
                accountNet = accountNet.toObject();


                /*use node info for now*/
                account.tokens = {};
                for (let i = 0; i < accountRaw.assetMap.length; i++) {
                    account.tokens[accountRaw.assetMap[i][0]] = accountRaw.assetMap[i][1];
                }
                account.tokens2 = await this.getNewTokens(address);

                account.trx = accountRaw.balance;
                account.frozen_balance = 0;
                account.frozen_expire_time = 0;
                if (accountRaw.frozenList.length > 0) {
                    account.frozen_balance = accountRaw.frozenList[0].frozenBalance;
                    account.frozen_expire_time = accountRaw.frozenList[0].expireTime;
                }
                account.net = accountNet;
            }
        } catch (e) {
            console.log('error fetching full account:');
            console.log(e);
        }
        return account;
    }

};
