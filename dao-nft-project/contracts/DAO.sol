// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MembershipNFT.sol";

contract DAO {
    struct Proposal {
        address proposalCreator;
        string description;
        uint256 deadline;
        uint256 votesFor;
        uint256 votesAgainst;
        bool executed;
        mapping(address => bool) hasVoted;
    }

    MembershipNFT public membershipNFT;
    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;

    event ProposalCreated(uint256 proposalId, address indexed creator, string description);
    event UserVoted(uint256 proposalId, address indexed voter, bool support);
    event ProposalExecuted(uint256 proposalId);

    error NotNFTHolder();
    error AlreadyVoted();
    error ProposalNotFound();
    error VotingPeriodEnded();
    error ProposalAlreadyExecuted();
    error ProposalNotApproved();

    constructor(string memory _baseTokenURI) payable {
        membershipNFT = new MembershipNFT(_baseTokenURI);
        membershipNFT.transferOwnership(address(this));

        membershipNFT.mintFirstToken(msg.sender);
    }

    modifier onlyNFTHolder() {
        if (membershipNFT.balanceOf(msg.sender) == 0) revert NotNFTHolder();
        _;
    }

    function createProposal(string calldata _description) external onlyNFTHolder {
        proposalCount++;
        Proposal storage p = proposals[proposalCount];
        p.proposalCreator = msg.sender;
        p.description = _description;
        p.deadline = block.timestamp + 7 days;

        emit ProposalCreated(proposalCount, msg.sender, _description);
    }

    function voteForProposal(uint256 _proposalId, bool support) external onlyNFTHolder {
        Proposal storage p = proposals[_proposalId];
        if (p.proposalCreator == address(0)) revert ProposalNotFound();
        if (p.deadline < block.timestamp) revert VotingPeriodEnded();
        if (p.hasVoted[msg.sender]) revert AlreadyVoted();

        p.hasVoted[msg.sender] = true;

        if (support) {
            p.votesFor++;
        } else {
            p.votesAgainst++;
        }

        emit UserVoted(_proposalId, msg.sender, support);
    }

    function executeProposal(uint256 _proposalId) external {
        Proposal storage p = proposals[_proposalId];
        if (p.proposalCreator == address(0)) revert ProposalNotFound();
        if (p.deadline > block.timestamp) revert VotingPeriodEnded();
        if (p.executed) revert ProposalAlreadyExecuted();
        if (p.votesFor <= p.votesAgainst) revert ProposalNotApproved();

        p.executed = true;

        emit ProposalExecuted(_proposalId);
    }
}