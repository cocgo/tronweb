const axios = require("axios");
const qs = require('qs');
const config = require("./config.json");
const tools = require("tron-http-tools");

module.exports = class{

    constructor(url_ = config.api_url){
        this.url = url_;
    }

    /*********************************************
     * ***************** GRPC ********************
     ********************************************/
    async getAccountProto(address){
        return await axios.get(this.url + "/grpc/getAccount?address=" + address).then(r => tools.accounts.accountFromBase64(r.data));
    }

    async getTransactionsToThisProto(address){
        return await axios.get(this.url + "/grpc/getTransactionsToThis?address=" + address).then(r => tools.transactions.transactionListFromBase64(r.data));
    }

    async getTransactionsFromThisProto(address){
        return await axios.get(this.url + "/grpc/getTransactionsFromThis?address=" + address).then(r => tools.transactions.transactionListFromBase64(r.data));
    }

    async getLastBlock(){
        return await axios.get(this.url + "/grpc/getLastBlock").then(r => tools.blocks.blockFromBase64(r.data));
    }

    async listWitnesses(){
        return await axios.get(this.url + "/witnesses").then(x => x.data);
    }

    /*********************************************
     ************ API USING OUR DB ***************
     ********************************************/

    async getAccount(address){
        return await axios.get(this.url + "/getAccount?address=" + address).then(x => x.data);
    }

    async getAccounts(addresses){
        return await axios.get(this.url + "/getAccounts?addresses=" + addresses.join(",")).then(x => x.data);
    }

    async getTransactionsToThis(address){
        return await axios.get(this.url + "/getTransactionsToThis?address=" + address).then(x => x.data);
    }

    async getTransactionsFromThis(address){
        return await axios.get(this.url + "/getTransactionsFromThis?address=" + address).then(x => x.data);
    }

    async getTransactionsRelatedToThis(address){
        return await axios.get(this.url + "/getTransactionsRelatedToThis?address=" + address).then(x => x.data);
    }

    async getTokens(){
        return await axios.get(this.url + "/getTokens").then(x => x.data);
    }

    /*********************************************
     *********** TRON FUNCTIONALITY **************
     ********************************************/

    async broadcastBase64Transaction(base64Signed){
      let response = await axios.post(this.url + "/grpc/broadcastTransaction", qs.stringify({transaction:base64Signed}));
      let decoded = tools.api.returnFromBase64(response.data).toObject();
      if(decoded && !decoded.result)
        decoded.message = Buffer.from(decoded.message, 'base64').toString();
      return decoded;
    }

    async signAndBroadcastTransaction(privateKey, unsigned){
        let signed = tools.transactions.signTransaction(privateKey, unsigned);
        let base64Signed = tools.utils.base64EncodeToString(signed.serializeBinary());
        return await this.broadcastBase64Transaction(base64Signed);
    }

    async sendTrx(privateKey, recipient, amount, remark){
        let nowBlock = await this.getLastBlock();
        let myAddress = tools.accounts.privateKeyToAddress(privateKey);
        let props = {
            sender : myAddress,
            recipient : recipient,
            amount : amount,
            remark : remark
        };
        let unsigned = await tools.transactions.createUnsignedTransferTransaction(props, nowBlock);
        return this.signAndBroadcastTransaction(privateKey, unsigned);
    }

    async sendToken(privateKey, recipient, amount, token){
        let nowBlock = await this.getLastBlock();
        let myAddress = tools.accounts.privateKeyToAddress(privateKey);
        let props = {
            sender : myAddress,
            recipient : recipient,
            amount : amount,
            assetName: token
        };
        let unsigned = await tools.transactions.createUnsignedTransferAssetTransaction(props, nowBlock);
        return this.signAndBroadcastTransaction(privateKey, unsigned);
    }

    async issueAsset(privateKey, props){
        let nowBlock = await this.getLastBlock();
        props.sender = tools.accounts.privateKeyToAddress(privateKey);

        let unsigned = await tools.transactions.createUnsignedAssetIssueTransaction(props, nowBlock);
        return this.signAndBroadcastTransaction(privateKey, unsigned);
    }

    async freezeTrx(privateKey, amount, duration=3){
        let nowBlock = await this.getLastBlock();
        let props = {
            ownerAddress : tools.accounts.privateKeyToAddress(privateKey),
            amount : amount,
            duration : duration
        };

        let unsigned = await tools.transactions.createUnsignedFreezeBalanceTransaction(props, nowBlock);
        return this.signAndBroadcastTransaction(privateKey, unsigned);
    }

    async unfreezeTrx(privateKey){
        let nowBlock = await this.getLastBlock();
        let props = {
            ownerAddress : tools.accounts.privateKeyToAddress(privateKey),
        };

        let unsigned = await tools.transactions.createUnsignedUnfreezeBalanceTransaction(props, nowBlock);
        return this.signAndBroadcastTransaction(privateKey, unsigned);
    }

    async participateToken(privateKey, props){
        let nowBlock = await this.getLastBlock();
        props.sender = tools.accounts.privateKeyToAddress(privateKey);

        let unsigned = await tools.transactions.createUnsignedParticipateAssetIssueTransaction(props, nowBlock);
        return this.signAndBroadcastTransaction(privateKey, unsigned);
    }

    async vote(privateKey, votes){
        let nowBlock = await this.getLastBlock();
        let props = {
            votes : votes,
            ownerAddress: tools.accounts.privateKeyToAddress(privateKey)
        };

        let unsigned = await tools.transactions.createUnsignedVoteWitnessTransaction(props, nowBlock);
        return this.signAndBroadcastTransaction(privateKey, unsigned);
    }
};
