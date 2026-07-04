// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/// @title SwapperNFT — Cyanic DEX Aggregator Reward NFT
/// @notice ERC-721 NFT awarded to users based on swap activity level.
///         Metadata is fully on-chain with dynamic SVG generation.
contract SwapperNFT is ERC721, Ownable {
    using Strings for uint256;

    uint256 private _tokenIdCounter;

    enum Level { Bronze, Silver, Gold, Platinum, Diamond, Elite }

    struct NFTData {
        Level    level;
        uint256  totalVolume; // USD, 1e6 precision
        uint256  swapCount;
        uint256  mintedAt;
        address  minter;
    }

    mapping(uint256 => NFTData)              public nftData;
    mapping(address => mapping(Level => bool)) public hasMinted;

    address public trustedSigner;

    event NFTMinted(address indexed user, uint256 tokenId, Level level);

    // ------------------------------------------------------------------
    constructor(address _signer)
        ERC721("Cyanic Swapper NFT", "CSNFT")
        Ownable(msg.sender)
    {
        trustedSigner = _signer;
    }

    // ------------------------------------------------------------------
    /// @notice Mint a level NFT after backend signature verification
    function mint(
        Level    level,
        uint256  totalVolume,
        uint256  swapCount,
        bytes calldata signature
    ) external {
        require(!hasMinted[msg.sender][level], "Already minted this level");
        require(
            _verifySignature(msg.sender, level, totalVolume, swapCount, signature),
            "Invalid signature"
        );

        uint256 tokenId = ++_tokenIdCounter;
        hasMinted[msg.sender][level] = true;

        nftData[tokenId] = NFTData({
            level:       level,
            totalVolume: totalVolume,
            swapCount:   swapCount,
            mintedAt:    block.timestamp,
            minter:      msg.sender
        });

        _safeMint(msg.sender, tokenId);
        emit NFTMinted(msg.sender, tokenId, level);
    }

    // ------------------------------------------------------------------
    /// @notice On-chain metadata with dynamic SVG
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");

        NFTData memory data = nftData[tokenId];
        string memory levelName = _getLevelName(data.level);
        string memory svgImage  = _generateSVG(data);

        string memory json = Base64.encode(bytes(string(abi.encodePacked(
            '{"name":"', levelName, ' Swapper #', tokenId.toString(), '",',
            '"description":"Earned by swapping on Cyanic DEX Aggregator on Base.",',
            '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svgImage)), '",',
            '"attributes":[',
                '{"trait_type":"Level","value":"',      levelName,                          '"},',
                '{"trait_type":"Total Volume USD","value":', (data.totalVolume / 1e6).toString(), '},',
                '{"trait_type":"Swap Count","value":',   data.swapCount.toString(),          '}',
            ']}'
        ))));

        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    // ------------------------------------------------------------------
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter;
    }

    function setSigner(address newSigner) external onlyOwner {
        trustedSigner = newSigner;
    }

    // ------------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------------

    function _generateSVG(NFTData memory data)
        internal
        pure
        returns (string memory)
    {
        string memory color = _getLevelColor(data.level);
        string memory levelName = _getLevelName(data.level);

        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">',
            // Background
            '<rect width="400" height="400" rx="20" fill="#0A0B0D"/>',
            // Border
            '<rect x="2" y="2" width="396" height="396" rx="19" fill="none" stroke="', color, '" stroke-width="2"/>',
            // Glow circle
            '<circle cx="200" cy="150" r="80" fill="', color, '" opacity="0.06"/>',
            '<circle cx="200" cy="150" r="60" fill="none" stroke="', color, '" stroke-width="1.5" opacity="0.5"/>',
            '<circle cx="200" cy="150" r="45" fill="none" stroke="', color, '" stroke-width="2"/>',
            // Logo lightning bolt
            '<text x="200" y="165" text-anchor="middle" fill="', color, '" font-family="Arial" font-size="40">',
            _getLevelEmoji(data.level),
            '</text>',
            // Level name
            '<text x="200" y="250" text-anchor="middle" fill="#FFFFFF" font-family="Arial" font-size="22" font-weight="bold">',
            levelName, ' CYANIC</text>',
            // Stats
            '<text x="200" y="290" text-anchor="middle" fill="#8B8FA8" font-family="Arial" font-size="13">',
            data.swapCount.toString(), ' swaps &bull; $', (data.totalVolume / 1e6).toString(), 'K volume</text>',
            // Network badge
            '<rect x="150" y="340" width="100" height="26" rx="13" fill="#0052FF" opacity="0.15"/>',
            '<text x="200" y="357" text-anchor="middle" fill="#0052FF" font-family="Arial" font-size="11" font-weight="bold">',
            'BASE NETWORK</text>',
            '</svg>'
        ));
    }

    function _getLevelColor(Level level) internal pure returns (string memory) {
        if (level == Level.Elite)    return "#FFD700";
        if (level == Level.Diamond)  return "#00C2FF";
        if (level == Level.Platinum) return "#E5E4E2";
        if (level == Level.Gold)     return "#FFA500";
        if (level == Level.Silver)   return "#C0C0C0";
        return "#CD7F32"; // Bronze
    }

    function _getLevelEmoji(Level level) internal pure returns (string memory) {
        if (level == Level.Elite)    return unicode"👑";
        if (level == Level.Diamond)  return unicode"💠";
        if (level == Level.Platinum) return unicode"💎";
        if (level == Level.Gold)     return unicode"🥇";
        if (level == Level.Silver)   return unicode"🥈";
        return unicode"🥉";
    }

    function _getLevelName(Level level) internal pure returns (string memory) {
        if (level == Level.Elite)    return "Elite";
        if (level == Level.Diamond)  return "Diamond";
        if (level == Level.Platinum) return "Platinum";
        if (level == Level.Gold)     return "Gold";
        if (level == Level.Silver)   return "Silver";
        return "Bronze";
    }

    // ------------------------------------------------------------------
    // Signature verification (ECDSA)
    // ------------------------------------------------------------------

    function _verifySignature(
        address  user,
        Level    level,
        uint256  volume,
        uint256  count,
        bytes calldata sig
    ) internal view returns (bool) {
        bytes32 hash = keccak256(
            abi.encodePacked(user, uint8(level), volume, count)
        );
        bytes32 ethHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
        );
        return _recoverSigner(ethHash, sig) == trustedSigner;
    }

    function _recoverSigner(bytes32 hash, bytes calldata sig)
        internal
        pure
        returns (address)
    {
        require(sig.length == 65, "Invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8   v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        return ecrecover(hash, v, r, s);
    }
}
