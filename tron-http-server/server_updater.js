const RpcClient = require("./rpcclient");
const {Decimal} = require('decimal.js');
const tools = require("tron-http-tools");

const {WitnessCreateContract, UpdateAssetContract, UnfreezeAssetContract, VoteAssetContract, UnfreezeBalanceContract, WithdrawBalanceContract, WitnessUpdateContract, TransferContract, TransferAssetContract, VoteWitnessContract, AssetIssueContract, FreezeBalanceContract, ParticipateAssetIssueContract, AccountUpdateContract} = require("tron-http-tools/protocol/core/Contract_pb");
const {Transaction} = require("tron-http-tools/protocol/core/Tron_pb");

const {getBase58CheckAddress, SHA256}= require('tron-http-tools/utils/crypto');
const ContractType = Transaction.Contract.ContractType;


function buf2hex(buffer) { // buffer is an ArrayBuffer
    return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}

const affectingContractTypes = {};
affectingContractTypes[ContractType.TRANSFERCONTRACT] = 1;
affectingContractTypes[ContractType.TRANSFERASSETCONTRACT] = 1;
affectingContractTypes[ContractType.ASSETISSUECONTRACT] = 1;
affectingContractTypes[ContractType.PARTICIPATEASSETISSUECONTRACT] = 1;
affectingContractTypes[ContractType.ACCOUNTUPDATECONTRACT] = 1;
affectingContractTypes[ContractType.FREEZEBALANCECONTRACT] = 1;
affectingContractTypes[ContractType.UNFREEZEBALANCECONTRACT] = 1;

module.exports = class{

    constructor(config, db, alertCallbacks=null){
        this.db = db;
        this.rpc = new RpcClient(config);
        this.alertCallbacks = alertCallbacks;

        this.main();
    }

    async getRpcBlockInfoByNum(id){
        let block = await this.rpc.getBlockByNum(id);
        if(!block.getBlockHeader())
            return null;
        let blockHeader = block.getBlockHeader().toObject();
        let blockId = blockHeader.rawData.number;
        let blockHash = tools.utils.uint8ToBase64(tools.blocks.getBlockHash(block));
        let blockParentHash = blockHeader.rawData.parenthash;

        return {
            block,
            blockHeader,
            blockId,
            blockHash,
            blockParentHash
        };
    }

    async loadBlocksBetween(start, end){
        for(let i = start;i<=end;i++){
            let blockLoadStart = Date.now();
            let block = await this.rpc.getBlockByNum(i);

            let blockHeader = block.getBlockHeader().toObject();
            let blockId = blockHeader.rawData.number;
            let blockHash = tools.utils.uint8ToBase64(tools.blocks.getBlockHash(block));
            let blockParentHash = blockHeader.rawData.parenthash;
            let transactionsList = block.getTransactionsList();

            let newBlock = {
                block_id : i,
                block_hash : blockHash,
                block_parent_hash : blockParentHash,
                num_transactions : 0
            };

            let newContracts = [];

            if(transactionsList.length > 0){
                for(let j = 0;j<transactionsList.length;j++){
                    let transaction = transactionsList[j];
                    let timestamp = parseInt(block.getBlockHeader().getRawData().getTimestamp());
                    let serialized = transaction.serializeBinary();
                    let hash = buf2hex(SHA256(serialized));
                    let txsize = serialized.length;

                    let contracts = transactionsList[j].getRawData().getContractList();

                    for (let c = 0; c < contracts.length; c++) {
                        let contract = contracts[c];
                        let type = contract.getType();
                        let parameter = contract.getParameter();
                        let value = parameter.getValue();
                        let desc = parameter.getTypeUrl().toString().split(".");
                        desc = desc[desc.length - 1];

                        /*
                          ACCOUNTCREATECONTRACT: 0,
                          TRANSFERCONTRACT: 1, <------IMPLEMENTED
                          TRANSFERASSETCONTRACT: 2, <-------- IMPLEMENTED
                          VOTEASSETCONTRACT: 3,
                          VOTEWITNESSCONTRACT: 4, <------IMPLEMENTED
                          WITNESSCREATECONTRACT: 5, <------IMPLEMENTED
                          ASSETISSUECONTRACT: 6, <------IMPLEMENTED
                          DEPLOYCONTRACT: 7,
                          WITNESSUPDATECONTRACT: 8, <-------- IMPLEMENTED
                          PARTICIPATEASSETISSUECONTRACT: 9, <-------- IMPLEMENTED
                          ACCOUNTUPDATECONTRACT: 10, <-------- IMPLEMENTED
                          FREEZEBALANCECONTRACT: 11, <------IMPLEMENTED
                          UNFREEZEBALANCECONTRACT: 12,
                          WITHDRAWBALANCECONTRACT: 13,
                          CUSTOMCONTRACT: 20
                         */

                        switch (type) {
                            case ContractType.TRANSFERCONTRACT://1
                            {
                                let contr = TransferContract.deserializeBinary(Uint8Array.from(value));
                                let ownerAddress = getBase58CheckAddress(Array.from(contr.getOwnerAddress()));
                                let toAddress = getBase58CheckAddress(Array.from(contr.getToAddress()));
                                let amount = contr.getAmount();
                                let remark = contr.getRemark();

                                newContracts.push({
                                    block_id : i,
                                    contract_type : type,
                                    contract_desc : desc,
                                    owner_address : ownerAddress,
                                    to_address : toAddress,
                                    amount : amount,
                                    timestamp : timestamp,
                                    txsize : txsize,
                                    txhash : hash,
                                    remark: remark
                                });
                            }
                                break;
                            case ContractType.TRANSFERASSETCONTRACT://2
                            {
                                let contr = TransferAssetContract.deserializeBinary(Uint8Array.from(value));
                                let ownerAddress = getBase58CheckAddress(Array.from(contr.getOwnerAddress()));
                                let toAddress = getBase58CheckAddress(Array.from(contr.getToAddress()));
                                let assetName = String.fromCharCode.apply(null, contr.getAssetName());
                                let amount = contr.getAmount();
                                let remark = contr.getRemark();

                                newContracts.push({
                                    block_id : i,
                                    contract_type : type,
                                    contract_desc : desc,
                                    owner_address : ownerAddress,
                                    to_address : toAddress,
                                    asset_name : assetName,
                                    amount : amount,
                                    timestamp : timestamp,
                                    txsize : txsize,
                                    txhash : hash,
                                    remark: remark
                                });
                            }
                                break;

                            case ContractType.VOTEWITNESSCONTRACT://4
                            {
                                let contr = VoteWitnessContract.deserializeBinary(Uint8Array.from(value));
                                let ownerAddress = getBase58CheckAddress(Array.from(contr.getOwnerAddress()));
                                let votesList = contr.getVotesList();
                                let votes = [];
                                for(let v = 0;v<votesList.length;v++){
                                    votes.push({
                                      vote_address : getBase58CheckAddress(Array.from(votesList[v].getVoteAddress())),
                                      vote_count : votesList[v].getVoteCount()
                                    })
                                }

                                newContracts.push({
                                    block_id : i,
                                    contract_type : type,
                                    contract_desc : desc,
                                    owner_address : ownerAddress,
                                    votes : votes,
                                    timestamp : timestamp,
                                    txsize : txsize,
                                    txhash : hash
                                });
                            }
                                break;
                            case ContractType.WITNESSCREATECONTRACT://5
                            {
                                let contr = WitnessCreateContract.deserializeBinary(Uint8Array.from(value));
                                let ownerAddress = getBase58CheckAddress(Array.from(contr.getOwnerAddress()));
                                let url = String.fromCharCode.apply(null, contr.getUrl());

                                newContracts.push({
                                    block_id : i,
                                    contract_type : type,
                                    contract_desc : desc,
                                    owner_address : ownerAddress,
                                    url : url,
                                    timestamp : timestamp,
                                    txsize : txsize,
                                    txhash : hash
                                });
                            }
                                break;
                            case ContractType.ASSETISSUECONTRACT: //6
                            {
                                let contr = AssetIssueContract.deserializeBinary(Uint8Array.from(value));
                                let ownerAddress = getBase58CheckAddress(Array.from(contr.getOwnerAddress()));

                                let name = String.fromCharCode.apply(null, contr.getName());
                                let abbr = null;
                                if(abbr = contr.getAbbr())
                                    abbr = String.fromCharCode.apply(null, abbr);
                                let description = null;
                                if(description = contr.getDescription())
                                    description = String.fromCharCode.apply(null, description);
                                let url = String.fromCharCode.apply(null, contr.getUrl());

                                newContracts.push({
                                    block_id : i,
                                    contract_type : type,
                                    contract_desc : desc,
                                    owner_address : ownerAddress,
                                    name : name,
                                    abbr : abbr,
                                    total_supply : contr.getTotalSupply(),
                                    trx_num : contr.getTrxNum(),
                                    num : contr.getNum(),
                                    start_time : contr.getStartTime(),
                                    end_time : contr.getEndTime(),
                                    vote_score : contr.getVoteScore(),
                                    description : description,
                                    url : url,
                                    timestamp : timestamp,
                                    txsize : txsize,
                                    txhash : hash
                                });
                            }
                                break;
                            case ContractType.WITNESSUPDATECONTRACT: //8
                            {
                                let contr = WitnessUpdateContract.deserializeBinary(Uint8Array.from(value));
                                let ownerAddress = getBase58CheckAddress(Array.from(contr.getOwnerAddress()));

                                newContracts.push({
                                    block_id : i,
                                    contract_type : type,
                                    contract_desc : desc,
                                    owner_address : ownerAddress,
                                    timestamp : timestamp,
                                    txsize : txsize,
                                    txhash : hash
                                });
                            }
                                break;
                            case ContractType.PARTICIPATEASSETISSUECONTRACT: //9
                            {
                                let contr = ParticipateAssetIssueContract.deserializeBinary(Uint8Array.from(value));
                                let ownerAddress = getBase58CheckAddress(Array.from(contr.getOwnerAddress()));
                                let toAddress = getBase58CheckAddress(Array.from(contr.getToAddress()));
                                let assetName = String.fromCharCode.apply(null, contr.getAssetName());
                                let amount = contr.getAmount();

                                newContracts.push({
                                    block_id : i,
                                    contract_type : type,
                                    contract_desc : desc,
                                    owner_address : ownerAddress,
                                    to_address : toAddress,
                                    asset_name : assetName,
                                    amount : amount,
                                    timestamp : timestamp,
                                    txsize : txsize,
                                    txhash : hash
                                });
                            }
                                break;
                            case ContractType.ACCOUNTUPDATECONTRACT: { //10
                                let contr = AccountUpdateContract.deserializeBinary(Uint8Array.from(value));
                                let ownerAddress = getBase58CheckAddress(Array.from(contr.getOwnerAddress()));
                                let accountName = "";

                                newContracts.push({
                                    block_id : i,
                                    contract_type : type,
                                    contract_desc : desc,
                                    owner_address : ownerAddress,
                                    account_name : accountName,
                                    timestamp : timestamp,
                                    txsize : txsize,
                                    txhash : hash
                                });
                            }
                                break;
                            case ContractType.FREEZEBALANCECONTRACT://11
                            {
                                let contr = FreezeBalanceContract.deserializeBinary(Uint8Array.from(value));
                                let ownerAddress = getBase58CheckAddress(Array.from(contr.getOwnerAddress()));
                                let frozenBalance = contr.getFrozenBalance();
                                let frozenDuration = contr.getFrozenDuration();

                                newContracts.push({
                                    block_id : i,
                                    contract_type : type,
                                    contract_desc : desc,
                                    owner_address : ownerAddress,
                                    frozen_balance : frozenBalance,
                                    frozen_duration : frozenDuration,
                                    timestamp : timestamp,
                                    txsize : txsize,
                                    txhash : hash
                                });
                            }
                                break;

                            case ContractType.UNFREEZEBALANCECONTRACT: //12
                            {
                                let contr = UnfreezeBalanceContract.deserializeBinary(Uint8Array.from(value));
                                let ownerAddress = getBase58CheckAddress(Array.from(contr.getOwnerAddress()));

                                newContracts.push({
                                    block_id : i,
                                    contract_type : type,
                                    contract_desc : desc,
                                    owner_address : ownerAddress,
                                    timestamp : timestamp,
                                    txsize : txsize,
                                    txhash : hash
                                });
                            }
                                break;
                            case ContractType.WITHDRAWBALANCECONTRACT: //13
                            {
                                let contr = WithdrawBalanceContract.deserializeBinary(Uint8Array.from(value));
                                let ownerAddress = getBase58CheckAddress(Array.from(contr.getOwnerAddress()));

                                newContracts.push({
                                    block_id : i,
                                    contract_type : type,
                                    contract_desc : desc,
                                    owner_address : ownerAddress,
                                    timestamp : timestamp,
                                    txsize : txsize,
                                    txhash : hash
                                });
                            }
                                break;
                            case ContractType.UPDATEASSETCONTRACT:
                            {
                                let contr = UpdateAssetContract.deserializeBinary(Uint8Array.from(value));
                                let ownerAddress = getBase58CheckAddress(Array.from(contr.getOwnerAddress()));

                                newContracts.push({
                                    block_id : i,
                                    contract_type : type,
                                    contract_desc : desc,
                                    owner_address : ownerAddress,
                                    timestamp : timestamp,
                                    txsize : txsize,
                                    txhash : hash
                                });
                            }
                            break;
                            case ContractType.UNFREEZEASSETCONTRACT: //unfreezeassetcontract
                            {
                                //let contr = UnfreezeAssetContract.deserializeBinary(Uint8Array.from(value));
                                //let ownerAddress = getBase58CheckAddress(Array.from(contr.getOwnerAddress()));

                                newContracts.push({
                                    block_id : i,
                                    contract_type : type,
                                    contract_desc : desc,
                                    owner_address : "UNKNOWN_NEEDS_FIXING",
                                    timestamp : timestamp,
                                    txsize : txsize,
                                    txhash : hash
                                });
                            }
                            break;
                            default:
                                console.log(`UNIMPLEMENTED CONTRACT TYPE ${desc}`);
                                newContracts.push({
                                    block_id : i,
                                    contract_type : type,
                                    contract_desc : desc,
                                    timestamp : timestamp,
                                    unhandled : true,
                                    txsize : txsize,
                                    txhash : hash
                                });
                        }
                    }
                }
            }

            if(newContracts.length > 0){
                newBlock.num_contracts = newContracts.length;
                await this.db.insertContracts(newContracts);
                await this.updateDbAccounts(newContracts);
            }

            await this.db.insertBlock(newBlock);
            console.log(`inserting block ${i} took ${Date.now() - blockLoadStart}`);
        }
    }

    getNewDbAccount(address){
        return {
            address : address,
            trx : 0,
            tokens : {

            },
            last_block : -1
        }
    }

    /*adds the asset object to an account if not present*/
    accountVerifyHasAsset(account, name){
        if(!account.tokens[name]){
            account.tokens[name] = {
                amount : 0
            };
        }
        return account;
    }

    /*amount has to be Decimal*/
    accountAddTokenBalance(account, assetName, amount){
        if(assetName.indexOf('$') >= 0)
            return account;
		if(assetName.indexOf('.') >= 0)
            return account;
        account = this.accountVerifyHasAsset(account, assetName);
        account.tokens[assetName].amount = new Decimal(account.tokens[assetName].amount).add(amount).toString();
        return account;
    }

    async updateDbAccount(account, contracts){
        return;

        let biggestBlock = account.last_block;
        for(let c in contracts){
            let contract = contracts[c];
            if(account.last_block >= contract.block_id){
                //console.log(`account ${account.address} skipping block ${contract.block_id}, already at block ${account.last_block}`);
                continue;
            }

            if(contract.block_id > biggestBlock)
                biggestBlock = contract.block_id;

            switch (contract.contract_type){
                case ContractType.TRANSFERCONTRACT:
                    {
                        let amount = new Decimal(contract.amount);
                        let trx = new Decimal(account.trx);

                        if(contract.owner_address == account.address){
                            account.trx = trx.minus(amount).toString();
                        }
                        if(contract.to_address == account.address){
                            account.trx = trx.plus(amount).toString();
                        }
                    }
                    break;
                case ContractType.TRANSFERASSETCONTRACT:
                    {

                        let amount = new Decimal(contract.amount);
                        let name = contract.asset_name;

                        if(contract.owner_address == account.address){
                            account = this.accountAddTokenBalance(account, name, amount);
                        }
                        if(contract.to_address == account.address){
                            account = this.accountAddTokenBalance(account, name, amount.mul(-1));
                        }
                    }
                    break;
                case ContractType.ASSETISSUECONTRACT:
                    {

                        let amount = new Decimal(contract.total_supply);
                        let name = contract.name;
                        if(contract.owner_address == account.address){
                            account = this.accountAddTokenBalance(account, name, amount);
                        }
                    }
                    break;
                case ContractType.PARTICIPATEASSETISSUECONTRACT:
                    {

                        let amount = new Decimal(contract.amount);
                        let name = contract.asset_name;
                        if(contract.owner_address == account.address){
                            account = this.accountAddTokenBalance(account, name, amount);
                        }
                    }
                    break;
                case ContractType.ACCOUNTUPDATECONTRACT:
                    if(contract.owner_address == account.address) {
                        account.account_name = contract.account_name
                    }
                    break;
                case ContractType.FREEZEBALANCECONTRACT:
                    account.frozen_balance = contract.frozen_balance;
                    break;
                case ContractType.UNFREEZEBALANCECONTRACT:
                    account.frozen_balance = 0;
                    break;
                default:
                    throw `updateDbAccount contract not implemented: ${contract.contract_desc}`;
            }
        }
        account.last_block = biggestBlock;

        await this.db.insertAccount(account);
        //console.log('finished account: ' + JSON.stringify(account));
    }

    /*updates the accounts stored in the 'accounts' collection*/
    async updateDbAccounts(newContracts){
        /*contracts which affect the state of an account, meaning the account has to be updated.*/

        //update accounts
        //let affectedAddresses = [];
        let addressContractLinks = {};
        for(let c in newContracts){
            let contract = newContracts[c];
            if(true && affectingContractTypes[contract.contract_type]){ //enabled for everything for now. Only used for alerts anyway
                //console.log(`contract of type ${contract.contract_desc} is affecting balance`);

                let ownerAddress = contract.owner_address;
                let toAddress = contract.to_address;
                if(ownerAddress){
                    if(!addressContractLinks[ownerAddress])
                        addressContractLinks[ownerAddress] = [];
                    addressContractLinks[ownerAddress].push(contract);
                }

                if(toAddress && ownerAddress != toAddress){
                    if(!addressContractLinks[toAddress])
                        addressContractLinks[toAddress] = [];
                    addressContractLinks[toAddress].push(contract);
                }
            }else{
                //console.log(contract.contract_desc);
            }
        }

        let addresses = Object.keys(addressContractLinks);
        //let backupAddresses = addresses.slice();

        /*
        let accounts = await this.db.getAccounts(addresses);

        for(let a in accounts){
            let account = accounts[a];
            await this.updateDbAccount(account, addressContractLinks[account.address]);
            let index = addresses.indexOf(account.address);
            addresses.splice(addresses.indexOf(account.address), 1);
        }
        */

        /*
        if(addresses.length > 0)
            console.log(`${addresses.length} accounts were previously unknown`);
        for(let a in addresses){
            let address = addresses[a];
            let account = this.getNewDbAccount(address);
            await this.updateDbAccount(account, addressContractLinks[address]);
        }
        */

        if(this.alertCallbacks !== null){
            this.alertCallbacks(addresses);
        }
    }

    async findFirstNonForkedBlock(min, max){
        //this is going 10 back at a time, because usually forks are only short.
        //might want to replace with binary search at some point

        let current = max;
        let steps = 10;
        while(current > 0){
            let rpcBlock = await this.getRpcBlockInfoByNum(current);
            let dbBlock = await this.db.getBlockByNum(current);

            if(!rpcBlock){
                console.log('rpc block didnt return sensible value');
                console.log(rpcBlock);
                return current -1;
            }

            if(dbBlock.block_hash == rpcBlock.blockHash ||
                dbBlock.block_parent_hash == rpcBlock.blockParentHash){
                //non-forked block detected
                return current;
            }else{
                console.log('forked block: ' + current);
                if(current == 1){
                    //giving up
                    current=0;
                }else{
                    current -= steps;
                    if(current < 1)
                        current = 1;
                    steps++;
                }
            }
        }

        throw 'this should never happen because complete forks should be detected before.';
    }

    async cleanForkedDbBlocks(lastDbBlock){
        let rpcBlock = await this.getRpcBlockInfoByNum(lastDbBlock.block_id);
        if(rpcBlock !== null &&
            lastDbBlock.block_hash == rpcBlock.blockHash &&
            lastDbBlock.block_parent_hash == rpcBlock.blockParentHash &&
            lastDbBlock.block_id == rpcBlock.blockId){
            return lastDbBlock.block_id;
        }

        let rpcBlockZero = await this.getRpcBlockInfoByNum(0);
        let dbBlockZero = await this.db.getBlockByNum(0);

        if(dbBlockZero.block_hash != rpcBlockZero.blockHash ||
            dbBlockZero.block_parent_hash != rpcBlockZero.blockParentHash){

            console.log('block zero:');
            console.log(rpcBlockZero);
            console.log('current:');
            console.log(lastDbBlock);

            console.log(`fork detected! complete reset. starting from zero`);
            this.db.deleteBlocksStartingAt(0);
            return -1;
        }


        let firstNonForkedBlock = await this.findFirstNonForkedBlock(0, lastDbBlock.block_id);
        await this.db.deleteBlocksStartingAt(firstNonForkedBlock);
        console.log(`cleaned forked blocks between ${firstNonForkedBlock} and ${lastDbBlock.block_id}`)
    }

    async main(){
        let startTime = Date.now();

        let lastDbBlock = await this.db.getLastBlock();
        if(lastDbBlock === false)
            return;

        let nowBlock = await this.rpc.getNowBlock();
        let nowBlockHeader = nowBlock.getBlockHeader().toObject();
        let nowBlockId = nowBlockHeader.rawData.number;


        if (typeof lastDbBlock === 'undefined'){
            //no blocks in the database
            await this.loadBlocksBetween(0, nowBlockId).catch((e)=>{
               console.log(e);
               console.log("crash on position 1");
            });
        }else{
            let lastValidBlockId = await this.cleanForkedDbBlocks(lastDbBlock);
            let nextBlockId = lastValidBlockId + 1;
            if(nextBlockId < nowBlockId){
                await this.loadBlocksBetween(nextBlockId, nowBlockId).catch((e)=>{
                    console.log(e);
                    console.log("crash on position 2");
                });
            }
            //console.log(lastDbBlock);
        }

        let timeSpent = Date.now() - startTime;
        let nextMain = 1500 - timeSpent;
        if(nextMain < 0)
            nextMain = 0;
        setTimeout(()=>{
           this.main();
        },nextMain);
    }
}
