import { useEffect, useState } from "react";
import { ethers } from "ethers";
import "./App.css";

const CONTRACT_ADDRESS = "0xe676b80D6d4F975cC9E4E705959963802faAD0B9";

const BORROWER_ADDRESS =
  "0xDAC4389AccE4a693477921C1FB0c45756f89c6A0".toLowerCase();

const LENDER_ADDRESS =
  "0x82A0367aF28d42762E6557485cFe54e43c59A1f2".toLowerCase();

const CONTRACT_ABI = [
  "function createLoanRequest(uint256 _amount, uint256 _interestRate, uint256 _durationDays, string memory _purpose) public",
  "function fundLoan(uint256 _loanId) public payable",
  "function repayLoan(uint256 _loanId) public payable",
  "function cancelLoan(uint256 _loanId) public",
  "function getAllLoans() public view returns (tuple(uint256 id,address borrower,address lender,uint256 amount,uint256 interestRate,uint256 totalRepayment,uint256 durationDays,uint256 createdAt,uint256 dueDate,string purpose,uint8 status)[])"
];

function App() {
  const [selectedRole, setSelectedRole] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);

  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);
  const [loans, setLoans] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [amount, setAmount] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [purpose, setPurpose] = useState("");

  const resetApp = () => {
    setIsSignedIn(false);
    setSelectedRole("");
    setAccount("");
    setContract(null);
    setLoans([]);
    setAmount("");
    setDurationDays("");
    setPurpose("");
    setTransactions([]);
  };

  const isCorrectAccountForRole = (role, walletAddress) => {
    const currentAddress = walletAddress.toLowerCase();

    if (role === "borrower") {
      return currentAddress === BORROWER_ADDRESS;
    }

    if (role === "lender") {
      return currentAddress === LENDER_ADDRESS;
    }

    return false;
  };

  const switchToSepolia = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask.");
      throw new Error("MetaMask not installed");
    }

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }]
      });
    } catch (error) {
      console.error("Switch network error:", error);
      alert("Please switch MetaMask network to Sepolia.");
      throw error;
    }
  };

  const setupContract = async () => {
    await switchToSepolia();

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    const lendChain = new ethers.Contract(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      signer
    );

    return lendChain;
  };

  const connectWallet = async () => {
    try {
      if (!selectedRole) {
        alert("Please choose Borrower or Lender first.");
        return;
      }

      if (!window.ethereum) {
        alert("Please install MetaMask.");
        return;
      }

      await switchToSepolia();

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts"
      });

      const selectedAccount = accounts[0];

      if (!isCorrectAccountForRole(selectedRole, selectedAccount)) {
        alert(
          selectedRole === "borrower"
            ? "This Borrower side is only for the borrower account. Please switch to the borrower MetaMask account."
            : "This Lender side is only for the lender account. Please switch to the lender MetaMask account."
        );
        return;
      }

      const lendChain = await setupContract();

      setAccount(selectedAccount);
      setContract(lendChain);
      setIsSignedIn(true);

      const data = await lendChain.getAllLoans();
      setLoans(data);
    } catch (error) {
      console.error("Wallet error:", error);
      alert(error.message || "Wallet connection failed.");
    }
  };

  const logout = () => {
    resetApp();
  };

  const switchAccount = async () => {
    try {
      if (!window.ethereum) {
        alert("Please install MetaMask.");
        return;
      }

      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }]
      });

      alert("Account changed. Please choose your role and sign in again.");

      resetApp();
    } catch (error) {
      console.error("Switch account error:", error);
      alert("Account switch cancelled or failed. Please try again.");
    }
  };

  const loadLoans = async () => {
    try {
      if (!contract) return;

      await switchToSepolia();

      const data = await contract.getAllLoans();
      setLoans(data);
    } catch (error) {
      console.error("Load loans error:", error);
    }
  };

  const addTransactionHash = (type, hash) => {
    const newTransaction = {
      type,
      hash,
      date: new Date().toLocaleString()
    };

    setTransactions((prev) => [newTransaction, ...prev]);
  };

  const calculateInterestRate = (days) => {
    const duration = Number(days);

    if (duration >= 1 && duration <= 7) return 5;
    if (duration >= 8 && duration <= 14) return 8;
    if (duration >= 15 && duration <= 30) return 10;
    if (duration >= 31 && duration <= 60) return 15;

    return 20;
  };

  const createLoan = async () => {
    try {
      if (!contract) {
        alert("Please sign in first.");
        return;
      }

      if (selectedRole !== "borrower") {
        alert("Only the borrower can create a loan request.");
        return;
      }

      if (!isCorrectAccountForRole("borrower", account)) {
        alert("Wrong account. Please use the borrower MetaMask account.");
        resetApp();
        return;
      }

      if (!amount || !durationDays || !purpose) {
        alert("Please complete all fields.");
        return;
      }

      if (Number(amount) <= 0) {
        alert("Loan amount must be greater than zero.");
        return;
      }

      if (Number(durationDays) <= 0) {
        alert("Duration must be greater than zero.");
        return;
      }

      await switchToSepolia();

      const amountInWei = ethers.parseEther(amount);
      const standardInterestRate = calculateInterestRate(durationDays);

      const transaction = await contract.createLoanRequest(
        amountInWei,
        standardInterestRate,
        durationDays,
        purpose
      );

      addTransactionHash("Create Loan", transaction.hash);

      await transaction.wait();

      alert("Loan request created successfully.");

      setAmount("");
      setDurationDays("");
      setPurpose("");

      loadLoans();
    } catch (error) {
      console.error("Create loan error:", error);
      alert("Failed to create loan request.");
    }
  };

  const fundLoan = async (loanId, loanAmount) => {
    try {
      if (!contract) {
        alert("Please sign in first.");
        return;
      }

      if (selectedRole !== "lender") {
        alert("Only the lender can fund a loan.");
        return;
      }

      if (!isCorrectAccountForRole("lender", account)) {
        alert("Wrong account. Please use the lender MetaMask account.");
        resetApp();
        return;
      }

      await switchToSepolia();

      const transaction = await contract.fundLoan(loanId, {
        value: loanAmount
      });

      addTransactionHash("Fund Loan", transaction.hash);

      await transaction.wait();

      alert("Loan funded successfully.");
      loadLoans();
    } catch (error) {
      console.error("Fund loan error:", error);
      alert(
        "Failed to fund loan. Make sure you are not the borrower and you have enough SepoliaETH."
      );
    }
  };

  const repayLoan = async (loanId, totalRepayment) => {
    try {
      if (!contract) {
        alert("Please sign in first.");
        return;
      }

      if (selectedRole !== "borrower") {
        alert("Only the borrower can repay a loan.");
        return;
      }

      if (!isCorrectAccountForRole("borrower", account)) {
        alert("Wrong account. Please use the borrower MetaMask account.");
        resetApp();
        return;
      }

      await switchToSepolia();

      const transaction = await contract.repayLoan(loanId, {
        value: totalRepayment
      });

      addTransactionHash("Repay Loan", transaction.hash);

      await transaction.wait();

      alert("Loan repaid successfully.");
      loadLoans();
    } catch (error) {
      console.error("Repay loan error:", error);
      alert("Failed to repay loan. Make sure you have enough SepoliaETH.");
    }
  };

  const cancelLoan = async (loanId) => {
    try {
      if (!contract) {
        alert("Please sign in first.");
        return;
      }

      if (selectedRole !== "borrower") {
        alert("Only the borrower can cancel a loan request.");
        return;
      }

      if (!isCorrectAccountForRole("borrower", account)) {
        alert("Wrong account. Please use the borrower MetaMask account.");
        resetApp();
        return;
      }

      await switchToSepolia();

      const transaction = await contract.cancelLoan(loanId);

      addTransactionHash("Cancel Loan", transaction.hash);

      await transaction.wait();

      alert("Loan cancelled.");
      loadLoans();
    } catch (error) {
      console.error("Cancel loan error:", error);
      alert("Failed to cancel loan.");
    }
  };

  const getStatus = (status) => {
    const statusList = ["Pending", "Funded", "Repaid", "Cancelled"];
    return statusList[Number(status)];
  };

  const getTotalRepaymentPreview = () => {
    if (!amount || !durationDays) return "0";

    const rate = calculateInterestRate(durationDays);
    const principal = Number(amount);
    const total = principal + principal * (rate / 100);

    return total.toFixed(6);
  };

  const getInterestEarned = (loan) => {
    return loan.totalRepayment - loan.amount;
  };

  const shortenAddress = (address) => {
    if (!address) return "";
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  const myBorrowerLoans = loans.filter(
    (loan) =>
      account && loan.borrower.toLowerCase() === account.toLowerCase()
  );

  const availableLoans = loans.filter(
    (loan) =>
      Number(loan.status) === 0 &&
      account &&
      loan.borrower.toLowerCase() !== account.toLowerCase()
  );

  const myLenderLoans = loans.filter(
    (loan) => account && loan.lender.toLowerCase() === account.toLowerCase()
  );

  const paidLenderLoans = myLenderLoans.filter(
    (loan) => Number(loan.status) === 2
  );

  useEffect(() => {
    if (!contract) return;

    const load = async () => {
      try {
        const data = await contract.getAllLoans();
        setLoans(data);
      } catch (error) {
        console.error("Load loans error:", error);
      }
    };

    load();
  }, [contract]);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = () => {
      alert("MetaMask account changed. Please choose your role and sign in again.");
      resetApp();
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isSignedIn) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">LC</div>

          <h1>LendChain</h1>
          <p>Blockchain-based peer-to-peer lending system</p>

          <div className="role-buttons">
            <button
              className={selectedRole === "borrower" ? "selected-role" : ""}
              onClick={() => setSelectedRole("borrower")}
            >
              <span>Borrower</span>
              <small>Use borrower account only</small>
            </button>

            <button
              className={selectedRole === "lender" ? "selected-role" : ""}
              onClick={() => setSelectedRole("lender")}
            >
              <span>Lender</span>
              <small>Use lender account only</small>
            </button>
          </div>

          {selectedRole && (
            <p className="selected-text">
              Selected role: <strong>{selectedRole.toUpperCase()}</strong>
            </p>
          )}

          <button className="signin-btn" onClick={connectWallet}>
            Sign In with MetaMask
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">LC</div>
          <h2>LendChain</h2>
          <p>Blockchain P2P Lending</p>
        </div>

        <div className="role-badge">Role: {selectedRole.toUpperCase()}</div>

        <div className="wallet-card">
          <span>Connected Wallet</span>
          <small>{account}</small>
        </div>

        <button onClick={switchAccount} className="switch-btn">
          Switch Account
        </button>

        <button onClick={logout} className="logout-btn">
          Sign Out
        </button>
      </aside>

      <main className="main">
        <section className="hero-card">
          <div className="hero-overlay"></div>

          <div className="hero-content">
            <div className="hero-badge">
              {selectedRole === "borrower" ? "Borrower Portal" : "Lender Portal"}
            </div>

            <h1>
              {selectedRole === "borrower"
                ? "Borrower Dashboard"
                : "Lender Dashboard"}
            </h1>

            <p>
              {selectedRole === "borrower"
                ? "Create loan requests, monitor your active loans, and repay funded loans with transparent blockchain records."
                : "Browse available loan requests, fund borrowers, and track your lending activity and repayments."}
            </p>

            <div className="hero-mini-stats">
              <div className="mini-stat">
                <span>Total Loans</span>
                <strong>{loans.length}</strong>
              </div>

              <div className="mini-stat">
                <span>Role</span>
                <strong>
                  {selectedRole === "borrower" ? "Borrower" : "Lender"}
                </strong>
              </div>

              <div className="mini-stat">
                <span>Wallet</span>
                <strong>{account ? shortenAddress(account) : "N/A"}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="section-title">
            <div>
              <p className="eyebrow">Blockchain Record</p>
              <h2>Transaction Hash History</h2>
            </div>
          </div>

          <p>
            Every blockchain action generates a transaction hash. This serves as
            proof that the action happened on Sepolia.
          </p>

          {transactions.length === 0 ? (
            <p className="empty-text">No transaction hash recorded yet.</p>
          ) : (
            <div className="hash-list">
              {transactions.map((tx, index) => (
                <div className="hash-card" key={index}>
                  <div className="hash-card-top">
                    <div>
                      <strong>{tx.type}</strong>
                      <span>{tx.date}</span>
                    </div>

                    <a
                      href={`https://sepolia.etherscan.io/tx/${tx.hash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View on Etherscan
                    </a>
                  </div>

                  <p>{tx.hash}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {selectedRole === "borrower" && (
          <>
            <section className="card">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Loan Guide</p>
                  <h2>Interest Rate Information</h2>
                </div>
              </div>

              <p>
                Interest is automatically based on the selected loan duration.
                Borrowers cannot manually change the interest rate.
              </p>

              <table className="interest-table">
                <thead>
                  <tr>
                    <th>Loan Duration</th>
                    <th>Standard Interest Rate</th>
                  </tr>
                </thead>

                <tbody>
                  <tr>
                    <td>1–7 days</td>
                    <td>5%</td>
                  </tr>
                  <tr>
                    <td>8–14 days</td>
                    <td>8%</td>
                  </tr>
                  <tr>
                    <td>15–30 days</td>
                    <td>10%</td>
                  </tr>
                  <tr>
                    <td>31–60 days</td>
                    <td>15%</td>
                  </tr>
                  <tr>
                    <td>61 days and above</td>
                    <td>20%</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section className="card">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Terms</p>
                  <h2>Repayment Terms</h2>
                </div>
              </div>

              <div className="terms-grid">
                <div className="term-item">
                  <strong>Total Repayment</strong>
                  <p>
                    The borrower must repay the original amount plus the
                    calculated interest.
                  </p>
                </div>

                <div className="term-item">
                  <strong>Funded Loan</strong>
                  <p>
                    Once a lender funds the loan, the status becomes Funded.
                  </p>
                </div>

                <div className="term-item">
                  <strong>Repayment</strong>
                  <p>The borrower can repay only after the loan is funded.</p>
                </div>

                <div className="term-item">
                  <strong>Cancellation</strong>
                  <p>
                    A borrower can only cancel a loan while it is still Pending.
                  </p>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Request</p>
                  <h2>Create Loan Request</h2>
                </div>
              </div>

              <div className="form-grid">
                <input
                  type="number"
                  placeholder="Loan amount in ETH, example: 0.001"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />

                <input
                  type="number"
                  placeholder="Duration in days, example: 7"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                />

                <input
                  type="text"
                  placeholder="Purpose of loan"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                />
              </div>

              <div className="interest-preview">
                <div>
                  <span>Standard Interest Rate</span>
                  <strong>
                    {durationDays ? calculateInterestRate(durationDays) : 0}%
                  </strong>
                </div>

                <div>
                  <span>Estimated Total Repayment</span>
                  <strong>{getTotalRepaymentPreview()} ETH</strong>
                </div>
              </div>

              <button onClick={createLoan} className="primary-action">
                Create Loan
              </button>
            </section>

            <section className="card">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Records</p>
                  <h2>My Loan Requests</h2>
                </div>

                <button onClick={loadLoans}>Refresh</button>
              </div>

              {myBorrowerLoans.length === 0 ? (
                <p className="empty-text">You have no loan requests yet.</p>
              ) : (
                <div className="loan-grid">
                  {myBorrowerLoans.map((loan) => (
                    <div className="loan-card" key={Number(loan.id)}>
                      <div className="loan-card-header">
                        <h3>Loan #{Number(loan.id)}</h3>
                        <span className={`status-pill status-${Number(loan.status)}`}>
                          {getStatus(loan.status)}
                        </span>
                      </div>

                      <p>
                        <strong>Amount:</strong>{" "}
                        {ethers.formatEther(loan.amount)} ETH
                      </p>
                      <p>
                        <strong>Interest:</strong>{" "}
                        {Number(loan.interestRate)}%
                      </p>
                      <p>
                        <strong>Total Repayment:</strong>{" "}
                        {ethers.formatEther(loan.totalRepayment)} ETH
                      </p>
                      <p>
                        <strong>Duration:</strong>{" "}
                        {Number(loan.durationDays)} days
                      </p>
                      <p>
                        <strong>Purpose:</strong> {loan.purpose}
                      </p>
                      <p>
                        <strong>Lender:</strong> {loan.lender}
                      </p>

                      {Number(loan.status) === 0 && (
                        <button
                          className="danger"
                          onClick={() => cancelLoan(loan.id)}
                        >
                          Cancel Loan
                        </button>
                      )}

                      {Number(loan.status) === 1 && (
                        <button
                          onClick={() =>
                            repayLoan(loan.id, loan.totalRepayment)
                          }
                        >
                          Repay Loan
                        </button>
                      )}

                      {Number(loan.status) === 2 && (
                        <p className="status-paid">This loan has been repaid.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {selectedRole === "lender" && (
          <>
            <section className="card">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Terms</p>
                  <h2>Lender Repayment Terms</h2>
                </div>
              </div>

              <div className="terms-grid">
                <div className="term-item">
                  <strong>Funding</strong>
                  <p>
                    The lender must send the exact amount requested by the
                    borrower.
                  </p>
                </div>

                <div className="term-item">
                  <strong>Expected Return</strong>
                  <p>
                    The lender receives the original amount plus interest after
                    repayment.
                  </p>
                </div>

                <div className="term-item">
                  <strong>Loan History</strong>
                  <p>Funded loans appear in My Lending History.</p>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Marketplace</p>
                  <h2>Available Loan Requests</h2>
                </div>

                <button onClick={loadLoans}>Refresh</button>
              </div>

              {availableLoans.length === 0 ? (
                <p className="empty-text">No available loan requests.</p>
              ) : (
                <div className="loan-grid">
                  {availableLoans.map((loan) => (
                    <div className="loan-card" key={Number(loan.id)}>
                      <div className="loan-card-header">
                        <h3>Loan #{Number(loan.id)}</h3>
                        <span className={`status-pill status-${Number(loan.status)}`}>
                          {getStatus(loan.status)}
                        </span>
                      </div>

                      <p>
                        <strong>Borrower:</strong> {loan.borrower}
                      </p>
                      <p>
                        <strong>Amount:</strong>{" "}
                        {ethers.formatEther(loan.amount)} ETH
                      </p>
                      <p>
                        <strong>Interest:</strong>{" "}
                        {Number(loan.interestRate)}%
                      </p>
                      <p>
                        <strong>Total Repayment:</strong>{" "}
                        {ethers.formatEther(loan.totalRepayment)} ETH
                      </p>
                      <p>
                        <strong>Duration:</strong>{" "}
                        {Number(loan.durationDays)} days
                      </p>
                      <p>
                        <strong>Purpose:</strong> {loan.purpose}
                      </p>

                      <button onClick={() => fundLoan(loan.id, loan.amount)}>
                        Fund Loan
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="card">
              <div className="section-header">
                <div>
                  <p className="eyebrow">History</p>
                  <h2>My Lending History</h2>
                </div>

                <button onClick={loadLoans}>Refresh</button>
              </div>

              {myLenderLoans.length === 0 ? (
                <p className="empty-text">You have not funded any loans yet.</p>
              ) : (
                <div className="loan-grid">
                  {myLenderLoans.map((loan) => (
                    <div className="loan-card" key={Number(loan.id)}>
                      <div className="loan-card-header">
                        <h3>Loan #{Number(loan.id)}</h3>
                        <span className={`status-pill status-${Number(loan.status)}`}>
                          {getStatus(loan.status)}
                        </span>
                      </div>

                      <p>
                        <strong>Borrower:</strong> {loan.borrower}
                      </p>
                      <p>
                        <strong>Amount Lent:</strong>{" "}
                        {ethers.formatEther(loan.amount)} ETH
                      </p>
                      <p>
                        <strong>Interest:</strong>{" "}
                        {Number(loan.interestRate)}%
                      </p>
                      <p>
                        <strong>Expected Repayment:</strong>{" "}
                        {ethers.formatEther(loan.totalRepayment)} ETH
                      </p>
                      <p>
                        <strong>Duration:</strong>{" "}
                        {Number(loan.durationDays)} days
                      </p>
                      <p>
                        <strong>Purpose:</strong> {loan.purpose}
                      </p>

                      {Number(loan.status) === 1 && (
                        <p className="status-waiting">
                          Waiting for borrower repayment.
                        </p>
                      )}

                      {Number(loan.status) === 2 && (
                        <p className="status-paid">Loan has been paid.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="card">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Completed</p>
                  <h2>Paid Loans</h2>
                </div>
              </div>

              {paidLenderLoans.length === 0 ? (
                <p className="empty-text">No paid loans yet.</p>
              ) : (
                <div className="loan-grid">
                  {paidLenderLoans.map((loan) => (
                    <div className="loan-card" key={Number(loan.id)}>
                      <div className="loan-card-header">
                        <h3>Paid Loan #{Number(loan.id)}</h3>
                        <span className="status-pill status-2">Repaid</span>
                      </div>

                      <p>
                        <strong>Borrower:</strong> {loan.borrower}
                      </p>
                      <p>
                        <strong>Original Amount:</strong>{" "}
                        {ethers.formatEther(loan.amount)} ETH
                      </p>
                      <p>
                        <strong>Total Received:</strong>{" "}
                        {ethers.formatEther(loan.totalRepayment)} ETH
                      </p>
                      <p>
                        <strong>Interest Earned:</strong>{" "}
                        {ethers.formatEther(getInterestEarned(loan))} ETH
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;