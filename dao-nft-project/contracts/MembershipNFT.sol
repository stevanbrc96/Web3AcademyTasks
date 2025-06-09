// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MembershipNFT is ERC721, Ownable {
    uint256 public nextTokenId;
    uint256 public constant MINT_PRICE = 0.01 ether;
    mapping(address => bool) public hasMinted;
    string private baseTokenURI;

    event MembershipMinted(address indexed to, uint256 tokenId);

    constructor(string memory _baseTokenURI, address _initialRecipient) 
        ERC721("DAO Membership", "DAO") 
        Ownable(msg.sender) 
    {
        nextTokenId = 1;
        baseTokenURI = _baseTokenURI;

        _safeMint(_initialRecipient, nextTokenId);
        hasMinted[_initialRecipient] = true;
        nextTokenId++;
        
        emit MembershipMinted(_initialRecipient, nextTokenId - 1);
    }

    function mint() external payable {
        require(!hasMinted[msg.sender], "Already minted");
        require(msg.value == MINT_PRICE, "Incorrect ETH amount");

        uint256 tokenId = nextTokenId;
        nextTokenId++;

        _safeMint(msg.sender, tokenId);
        hasMinted[msg.sender] = true;

        emit MembershipMinted(msg.sender, tokenId);
    }

    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }

    function withdraw(address payable _to) external onlyOwner {
        _to.transfer(address(this).balance);
    }
}