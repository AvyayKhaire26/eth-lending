// import { expect } from "chai";
// import { ethers } from "hardhat";

// describe("SampleContract", function () {
//   it("Should return the initial message", async function () {
//     const [owner] = await ethers.getSigners();
    
//     const sampleFactory = await ethers.getContractFactory("SampleContract");
//     const sampleContract = await sampleFactory.deploy("Hello, World!");
    
//     expect(await sampleContract.message()).to.equal("Hello, World!");
//   });

//   it("Should update the message", async function () {
//     const [owner] = await ethers.getSigners();
    
//     const sampleFactory = await ethers.getContractFactory("SampleContract");
//     const sampleContract = await sampleFactory.deploy("Hello, World!");
    
//     await sampleContract.setMessage("New Message");
//     expect(await sampleContract.message()).to.equal("New Message");
//   });
// });
