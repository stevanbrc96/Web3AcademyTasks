// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MembershipNFT.sol"; 

contract DAO {
    enum VotingChoice { For, Against, Abstain }

    struct Proposal {
        address proposalCreator;
        string description;
        uint256 deadline;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 votesAbstain;
        bool executed;
        mapping(address => bool) hasVoted;
    }

    MembershipNFT public membershipNFT;
    uint256 public proposalCount;
    mapping(uint256 => Proposal) private proposals;

    event ProposalCreated(uint256 proposalId, address indexed creator, string description);
    event UserVoted(uint256 proposalId, address indexed voter, VotingChoice choice);
    event ProposalExecuted(uint256 proposalId, bool passed);

    error NotNFTHolder();
    error AlreadyVoted();
    error ProposalNotFound();
    error VotingPeriodEnded();
    error ProposalAlreadyExecuted();

    constructor(string memory _baseTokenURI) payable {
        membershipNFT = new MembershipNFT(_baseTokenURI);
        membershipNFT.transferOwnership(address(this));
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

    function voteForProposal(uint256 _proposalId, VotingChoice choice) external onlyNFTHolder {
        Proposal storage p = proposals[_proposalId];
        if (p.proposalCreator == address(0)) revert ProposalNotFound();
        if (p.deadline < block.timestamp) revert VotingPeriodEnded();
        if (p.hasVoted[msg.sender]) revert AlreadyVoted();

        p.hasVoted[msg.sender] = true;

        if (choice == VotingChoice.For) {
            p.votesFor++;
        } else if (choice == VotingChoice.Against) {
            p.votesAgainst++;
        } else if (choice == VotingChoice.Abstain) {
            p.votesAbstain++;
        }

        emit UserVoted(_proposalId, msg.sender, choice);
    }

    function proposalPassed(uint256 _proposalId) public view returns (bool) {
        Proposal storage p = proposals[_proposalId];
        return p.votesFor > (p.votesAgainst + p.votesAbstain);
    }

    function executeProposal(uint256 _proposalId) external {
        Proposal storage p = proposals[_proposalId];
        if (p.proposalCreator == address(0)) revert ProposalNotFound();
        if (p.deadline > block.timestamp) revert VotingPeriodEnded();
        if (p.executed) revert ProposalAlreadyExecuted();

        p.executed = true;
        bool passed = proposalPassed(_proposalId);

        emit ProposalExecuted(_proposalId, passed);
    }

    function getProposal(uint256 _proposalId)
        external
        view
        returns (
            address proposalCreator,
            string memory description,
            uint256 deadline,
            uint256 votesFor,
            uint256 votesAgainst,
            uint256 votesAbstain,
            bool executed
        )
    {
        Proposal storage p = proposals[_proposalId];
        proposalCreator = p.proposalCreator;
        description = p.description;
        deadline = p.deadline;
        votesFor = p.votesFor;
        votesAgainst = p.votesAgainst;
        votesAbstain = p.votesAbstain;
        executed = p.executed;
    }
}
