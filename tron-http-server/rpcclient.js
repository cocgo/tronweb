const caller = require("grpc-caller");
const tools = require("tron-http-tools");

const {EmptyMessage, NumberMessage, BytesMessage} = require("tron-http-tools//protocol/api/api_pb");
const {WalletClient, WalletSolidityClient} = require("tron-http-tools/protocol/api/api_grpc_pb");
const {Account, Block, Transaction} = require("tron-http-tools/protocol/core/Tron_pb");

module.exports = class{

    constructor(config){
        this.api_full = caller(`${config.fullnode.host}:${config.fullnode.port}`, WalletClient);
        this.api_solidity = caller(`${config.soliditynode.host}:${config.soliditynode.port}`, WalletSolidityClient);
    }

    async getNowBlock(){
        return await this.api_full.getNowBlock(new EmptyMessage());
    }

    async getBlockByNum(num){
        let message = new NumberMessage;
        message.setNum(num);
        return await this.api_full.getBlockByNum(message);
    }

    async listWitnesses(){
        return await this.api_full.listWitnesses(new EmptyMessage());
    }

    async getAccount(address){
        let account = new Account();
        account.setAddress(tools.utils.base58AddressToUint8Array(address));
        return await this.api_full.getAccount(account);
    }

    async getAccountNet(address){
        let account = new Account();
        account.setAddress(tools.utils.base58AddressToUint8Array(address));
        return await this.api_full.getAccountNet(account);
    }

    async getTransactionsToThis(address){
        let account = new Account();
        account.setAddress(tools.utils.base58AddressToUint8Array(address));
        return await this.api_solidity.getTransactionsToThis(account);
    }

    async getTransactionsFromThis(address){
        let account = new Account();
        account.setAddress(tools.utils.base58AddressToUint8Array(address));
        return await this.api_solidity.getTransactionsFromThis(account);
    }

    async broadcastTransaction(transaction){
        return await this.api_full.broadcastTransaction(transaction);
    }

    async broadcastBase64EncodedTransaction(b64Transaction){
        return await this.broadcastTransaction(tools.transactions.transactionFromBase64(b64Transaction));
    }
    
    async getTransaction(txId){
        let tx = new BytesMessage;
        tx.setValue(txId);
        return await this.api_full.getTransactionById(tx);
    }
}

