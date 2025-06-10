// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.3/contracts/token/ERC721/ERC721.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.3/contracts/access/Ownable.sol";

contract MembershipNFT is ERC721, Ownable {
    uint256 public nextTokenId;
    uint256 public constant MINT_PRICE = 0.01 ether;
    mapping(address => bool) public hasMinted;
    string private baseTokenURI;

    event MembershipMinted(address indexed to, uint256 tokenId);

    constructor(string memory _baseTokenURI) ERC721("DAO Membership", "DAO") Ownable() {
        nextTokenId = 1;
        baseTokenURI = _baseTokenURI;
    }

    function mintFirstToken(address _to) external onlyOwner {
        require(!hasMinted[_to], "Address already has minted an NFT.");
        _safeMint(_to, nextTokenId);
        hasMinted[_to] = true;
        emit MembershipMinted(_to, nextTokenId);
        nextTokenId++;
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

    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Failed to withdraw Ether");
    }

    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }
}