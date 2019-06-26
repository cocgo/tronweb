const MongoClient = require('mongodb').MongoClient;
const f = require('util').format;
const util = require('./util.js');

module.exports = class {

    constructor(){

    }

    async connect(config){
        return new Promise((resolve)=> {
            const url = f('mongodb://%s:%s@%s:27017/?authMechanism=%s&authSource=%s',
                config.mongo.username,
                config.mongo.password,
                config.mongo.host,
                config.mongo.auth_mechanism,
                config.mongo.db);

            MongoClient.connect(url, {useNewUrlParser:true},(err, client)=>{
                if(err){
                    console.log(err);
                    throw err;
                }

                this.db = client.db(config.mongo.db);

                console.log('connected to db');
                resolve();
            });
        });
    }

    async getLastBlock(){
        let lastBlock = await this.db.collection('blocks').find({}, {_id:false}).sort({block_id:-1}).limit(1).toArray();
        lastBlock = lastBlock[0];
        return lastBlock;
    }

    async getBlockByNum(num){
        return await this.db.collection('blocks').find({block_id:{$eq:num}}).limit(1).toArray().then(x => x[0]);
    }

    async deleteBlocksStartingAt(start){
        await this.db.collection('blocks').remove({block_id:{$gte:start}});
        await this.db.collection('assets').remove({block_id:{$gte:start}});
        await this.db.collection('contracts').remove({block_id:{$gte:start}});
    }

    async insertBlock(block){
        return await this.db.collection('blocks').insert(block);
    }

    async insertAsset(asset){
        return await this.db.collection('assets').insert(asset);
    }

    async insertContracts(contracts){
        return await this.db.collection('contracts').insert(contracts);
    }

    async getAccounts(addresses){
        return await this.db.collection('accounts').find({address : {$in: addresses}}).toArray();
    }

    async getAccount(address){
        return await this.db.collection('accounts').find({address : {$eq: address}}).toArray().then(x => x[0]);
    }

    async getAccountByName(name){
        return await this.db.collection('accounts').find({account_name: {$eq: name}}).toArray().then(x => x[0]);
    }

    async getTokens(keepBuys = false){
        let contracts = await this.db.collection('contracts').find({contract_desc: {$eq: "AssetIssueContract"}}).toArray();
        for (let i = 0; i < contracts.length; i++) {
            contracts[i].buys = await this.db.collection('contracts').find({
                asset_name: {$eq: contracts[i].name},
                contract_desc: {$eq: "ParticipateAssetIssueContract"}
            }).toArray();

            contracts[i].bought = 0;
            for (let j = 0; j < contracts[i].buys.length; j++) {
                contracts[i].bought += parseInt(contracts[i].buys[j].amount);
            }
            if(!keepBuys)
                delete contracts[i].buys;
        }
        return contracts;
    }

    async getAssetIssueContracts(assetNames){
      return await this.db.collection('contracts').find({contract_desc:'AssetIssueContract', name : {$in : assetNames}}).toArray();
    }

    async getAssetIssueContractsMap(assetNames){
        let contracts = await this.getAssetIssueContracts(assetNames);
        let output = {};
        for(let i = 0;i<contracts.length;i++){
            output[contracts[i].name] = contracts[i];
        }
        return output;
    }

    async addTokenToParticipateContracts(contracts){
      let assets = {};
      for(let i = 0;i<contracts.length;i++){
        if(contracts[i].contract_desc === 'ParticipateAssetIssueContract'){
            assets[contracts[i].asset_name] = 1;
        }
      }
      let keys = Object.keys(assets);
      if(keys.length === 0){
          return contracts;
      }else{
          let issueContractsMap = await this.getAssetIssueContractsMap(keys);
          for(let i = 0;i<contracts.length;i++){
            if(contracts[i].contract_desc === 'ParticipateAssetIssueContract'){
              contracts[i].asset_issue_contract = issueContractsMap[contracts[i].asset_name];
            }
          }
      }
      return contracts;
    }

    async getWitnessesUrlMap(witnesses){
      let contracts = await this.db.collection('contracts').find({contract_desc:'WitnessCreateContract', owner_address : {$in : witnesses}}).toArray();
      let output = {};
      for(let i = 0;i<contracts.length;i++){
          output[contracts[i].owner_address] = contracts[i];
      }
      return output;
    }

    async addWitnessUrlToVoteContracts(contracts){
        let witnesses = {};
        for(let i = 0;i<contracts.length;i++){
          if(contracts[i].contract_desc === 'VoteWitnessContract' && contracts[i].votes.length > 0){
            witnesses[contracts[i].votes[0].vote_address] = 1;
          }
        }
        let keys = Object.keys(witnesses);
        if(keys.length === 0){
            return contracts;
        }else{
            let witnessesUrlMap = await this.getWitnessesUrlMap(keys);
            for(let i = 0;i<contracts.length;i++){
              if(contracts[i].contract_desc === 'VoteWitnessContract' &&
                contracts[i].votes.length > 0) {

                  let witness = witnessesUrlMap[contracts[i].votes[0].vote_address];
                  contracts[i].witness = witness;
              }
            }
        }
        return contracts;
    }

    async getContractsFromThis(address){
        return await this.addWitnessUrlToVoteContracts(await this.addTokenToParticipateContracts(await this.db.collection('contracts').find({owner_address: {$eq: address}}).toArray()));
    }

    async getContractsToThis(address){
        return await this.addWitnessUrlToVoteContracts(await this.addTokenToParticipateContracts(await this.db.collection('contracts').find({to_address: {$eq: address}}).toArray()));
    }

    async getContractsRelatedToThis(address){
        return await this.addWitnessUrlToVoteContracts(await this.addTokenToParticipateContracts(await this.db.collection('contracts').find({$or:[{to_address:{$eq:address}},{owner_address:{$eq:address}}]}).sort({block_id:-1}).toArray()));
    }

    async insertAccount(a){
        let account = util.cloneObject(a);
        let address = account.address;
        delete account.address;
        await this.db.collection('accounts').update(
            {address : address},
            {$set: account,$setOnInsert: {address : address}},
            {upsert : true});
    }

}