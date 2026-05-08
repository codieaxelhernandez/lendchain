import { useEffect, useState } from "react";
import { ethers } from "ethers";
import "./App.css";
import logo from './lendchain.png';
import {
  Wallet,
  HandCoins,
  BadgeDollarSign,
  RefreshCw,
  LogOut,
  ArrowLeftRight,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  LayoutDashboard,
  FileText,
  CircleDollarSign,
  Landmark,
  History,
  BookOpen,
  ScrollText,
  PlusCircle,
  Zap,
} from "lucide-react";

const CONTRACT_ADDRESS = "0xe676b80D6d4F975cC9E4E705959963802faAD0B9";

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
  const [amount, setAmount] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [purpose, setPurpose] = useState("");

  const switchToSepolia = async () => {
    if (!window.ethereum) { alert("Please install MetaMask."); throw new Error("MetaMask not installed"); }
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xaa36a7" }] });
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
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  };

  const connectWallet = async () => {
    try {
      if (!selectedRole) { alert("Please choose Borrower or Lender first."); return; }
      if (!window.ethereum) { alert("Please install MetaMask."); return; }
      await switchToSepolia();
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const lendChain = await setupContract();
      setAccount(accounts[0]);
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
    setIsSignedIn(false); setSelectedRole(""); setAccount("");
    setContract(null); setLoans([]); setAmount(""); setDurationDays(""); setPurpose("");
  };

  const switchAccount = async () => {
    try {
      if (!window.ethereum) { alert("Please install MetaMask."); return; }
      await window.ethereum.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      await switchToSepolia();
      const lendChain = await setupContract();
      setAccount(accounts[0]); setContract(lendChain);
      const data = await lendChain.getAllLoans();
      setLoans(data);
      alert("Account switched successfully.");
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
    } catch (error) { console.error("Load loans error:", error); }
  };

  const calculateInterestRate = (days) => {
    const d = Number(days);
    if (d >= 1  && d <= 7)  return 5;
    if (d >= 8  && d <= 14) return 8;
    if (d >= 15 && d <= 30) return 10;
    if (d >= 31 && d <= 60) return 15;
    return 20;
  };

  const createLoan = async () => {
    try {
      if (!contract)                          { alert("Please sign in first."); return; }
      if (!amount || !durationDays || !purpose) { alert("Please complete all fields."); return; }
      if (Number(amount) <= 0)                { alert("Loan amount must be greater than zero."); return; }
      if (Number(durationDays) <= 0)          { alert("Duration must be greater than zero."); return; }
      await switchToSepolia();
      const amountInWei = ethers.parseEther(amount);
      const standardInterestRate = calculateInterestRate(durationDays);
      const tx = await contract.createLoanRequest(amountInWei, standardInterestRate, durationDays, purpose);
      await tx.wait();
      alert("Loan request created successfully.");
      setAmount(""); setDurationDays(""); setPurpose("");
      loadLoans();
    } catch (error) { console.error("Create loan error:", error); alert("Failed to create loan request."); }
  };

  const fundLoan = async (loanId, loanAmount) => {
    try {
      if (!contract) { alert("Please sign in first."); return; }
      await switchToSepolia();
      const tx = await contract.fundLoan(loanId, { value: loanAmount });
      await tx.wait();
      alert("Loan funded successfully.");
      loadLoans();
    } catch (error) { console.error("Fund loan error:", error); alert("Failed to fund loan. Make sure you are not the borrower and you have enough SepoliaETH."); }
  };

  const repayLoan = async (loanId, totalRepayment) => {
    try {
      if (!contract) { alert("Please sign in first."); return; }
      await switchToSepolia();
      const tx = await contract.repayLoan(loanId, { value: totalRepayment });
      await tx.wait();
      alert("Loan repaid successfully.");
      loadLoans();
    } catch (error) { console.error("Repay loan error:", error); alert("Failed to repay loan. Make sure you have enough SepoliaETH."); }
  };

  const cancelLoan = async (loanId) => {
    try {
      if (!contract) { alert("Please sign in first."); return; }
      await switchToSepolia();
      const tx = await contract.cancelLoan(loanId);
      await tx.wait();
      alert("Loan cancelled.");
      loadLoans();
    } catch (error) { console.error("Cancel loan error:", error); alert("Failed to cancel loan."); }
  };

  const getStatus  = (status) => ["Pending", "Funded", "Repaid", "Cancelled"][Number(status)];

  const getTotalRepaymentPreview = () => {
    if (!amount || !durationDays) return "0";
    const rate = calculateInterestRate(durationDays);
    const principal = Number(amount);
    return (principal + principal * (rate / 100)).toFixed(6);
  };

  const getInterestEarned = (loan) => loan.totalRepayment - loan.amount;
  const shortenAddress    = (addr) => addr ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : "";

  const myBorrowerLoans = loans.filter((l) => account && l.borrower.toLowerCase() === account.toLowerCase());
  const availableLoans  = loans.filter((l) => Number(l.status) === 0 && account && l.borrower.toLowerCase() !== account.toLowerCase());
  const myLenderLoans   = loans.filter((l) => account && l.lender.toLowerCase() === account.toLowerCase());
  const paidLenderLoans = myLenderLoans.filter((l) => Number(l.status) === 2);

  useEffect(() => {
    if (!contract) return;
    const load = async () => {
      try { const data = await contract.getAllLoans(); setLoans(data); }
      catch (e) { console.error("Load loans error:", e); }
    };
    load();
  }, [contract]);

  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = async (accounts) => {
      if (accounts.length === 0) { logout(); return; }
      try {
        await switchToSepolia();
        const lendChain = await setupContract();
        setAccount(accounts[0]); setContract(lendChain);
        const data = await lendChain.getAllLoans(); setLoans(data);
      } catch (e) { console.error("Account change error:", e); }
    };
    const handleChainChanged = () => window.location.reload();
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // helper so icon + text sit inline cleanly
  const ic = { verticalAlign: "middle", marginRight: 7 };

  // ─── LOGIN ────────────────────────────────────────────────────────────────────
  if (!isSignedIn) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo-wrap">
            <img src={logo} alt="LendChain" className="login-logo-img" />
          </div>

          <h1>LendChain</h1>
          <p>Blockchain-based peer-to-peer lending system</p>

          <div className="role-buttons">
            <button
              className={selectedRole === "borrower" ? "selected-role" : ""}
              onClick={() => setSelectedRole("borrower")}
            >
              <span><HandCoins size={19} style={ic} />Borrower</span>
              <small>Create a loan request</small>
            </button>
            <button
              className={selectedRole === "lender" ? "selected-role" : ""}
              onClick={() => setSelectedRole("lender")}
            >
              <span><BadgeDollarSign size={19} style={ic} />Lender</span>
              <small>Fund available loans</small>
            </button>
          </div>

          {selectedRole && (
            <p className="selected-text">
              Selected role: <strong>{selectedRole.toUpperCase()}</strong>
            </p>
          )}

          <button className="signin-btn" onClick={connectWallet}>
            <Wallet size={17} style={ic} />Sign In with MetaMask
          </button>
        </div>
      </div>
    );
  }

  // ─── MAIN APP ─────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="sidebar-logo-wrap">
            <img src={logo} alt="LendChain" className="sidebar-logo-img" />
          </div>
          <h2>LendChain</h2>
          <p>Blockchain P2P Lending</p>
        </div>

        <div className="role-badge">
          <Zap size={14} style={ic} />{selectedRole.toUpperCase()}
        </div>

        <div className="wallet-card">
          <span><Wallet size={12} style={{ verticalAlign: "middle", marginRight: 5 }} />Connected Wallet</span>
          <strong>{shortenAddress(account)}</strong>
          <small>{account}</small>
        </div>

        <button onClick={switchAccount} className="switch-btn">
          <ArrowLeftRight size={14} style={ic} />Switch Account
        </button>
        <button onClick={logout} className="logout-btn">
          <LogOut size={14} style={ic} />Sign Out
        </button>
      </aside>

      <main className="main">
        {/* HERO */}
        <section className="hero-card">
          <div className="hero-overlay" />
          <div className="hero-content">
            <div className="hero-badge">
              {selectedRole === "borrower"
                ? <><HandCoins size={13} style={ic} />Borrower Portal</>
                : <><BadgeDollarSign size={13} style={ic} />Lender Portal</>}
            </div>
            <h1>
              <LayoutDashboard size={34} style={{ verticalAlign: "middle", marginRight: 14 }} />
              {selectedRole === "borrower" ? "Borrower Dashboard" : "Lender Dashboard"}
            </h1>
            <p>
              {selectedRole === "borrower"
                ? "Create loan requests, monitor your active loans, and repay funded loans with transparent blockchain records."
                : "Browse available loan requests, fund borrowers, and track your lending activity and repayments."}
            </p>
            <div className="hero-mini-stats">
              <div className="mini-stat">
                <span><FileText size={12} style={{ verticalAlign: "middle", marginRight: 5 }} />Total Loans</span>
                <strong>{loans.length}</strong>
              </div>
              <div className="mini-stat">
                <span><ShieldCheck size={12} style={{ verticalAlign: "middle", marginRight: 5 }} />Role</span>
                <strong>{selectedRole === "borrower" ? "Borrower" : "Lender"}</strong>
              </div>
              <div className="mini-stat">
                <span><Wallet size={12} style={{ verticalAlign: "middle", marginRight: 5 }} />Wallet</span>
                <strong>{account ? shortenAddress(account) : "N/A"}</strong>
              </div>
            </div>
          </div>
        </section>

        {/* ── BORROWER ── */}
        {selectedRole === "borrower" && (
          <>
            {/* Interest rate table */}
            <section className="card">
              <div className="section-title">
                <div>
                  <p className="eyebrow"><BookOpen size={12} style={{ verticalAlign: "middle", marginRight: 5 }} />Loan Guide</p>
                  <h2>Interest Rate Information</h2>
                </div>
              </div>
              <p>Interest is automatically based on the selected loan duration. Borrowers cannot manually change the interest rate.</p>
              <table className="interest-table">
                <thead><tr><th>Loan Duration</th><th>Standard Interest Rate</th></tr></thead>
                <tbody>
                  <tr><td>1–7 days</td><td>5%</td></tr>
                  <tr><td>8–14 days</td><td>8%</td></tr>
                  <tr><td>15–30 days</td><td>10%</td></tr>
                  <tr><td>31–60 days</td><td>15%</td></tr>
                  <tr><td>61 days and above</td><td>20%</td></tr>
                </tbody>
              </table>
            </section>

            {/* Repayment terms */}
            <section className="card">
              <div className="section-title">
                <div>
                  <p className="eyebrow"><ScrollText size={12} style={{ verticalAlign: "middle", marginRight: 5 }} />Terms</p>
                  <h2>Repayment Terms</h2>
                </div>
              </div>
              <div className="terms-grid">
                <div className="term-item"><strong><CircleDollarSign size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />Total Repayment</strong><p>The borrower must repay the original amount plus the calculated interest.</p></div>
                <div className="term-item"><strong><Landmark size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />Funded Loan</strong><p>Once a lender funds the loan, the status becomes Funded.</p></div>
                <div className="term-item"><strong><CheckCircle2 size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />Repayment</strong><p>The borrower can repay only after the loan is funded.</p></div>
                <div className="term-item"><strong><XCircle size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />Cancellation</strong><p>A borrower can only cancel a loan while it is still Pending.</p></div>
              </div>
            </section>

            {/* Create loan */}
            <section className="card">
              <div className="section-title">
                <div>
                  <p className="eyebrow"><PlusCircle size={12} style={{ verticalAlign: "middle", marginRight: 5 }} />Request</p>
                  <h2>Create Loan Request</h2>
                </div>
              </div>
              <div className="form-grid">
                <input type="number" placeholder="Loan amount in ETH (e.g. 0.001)" value={amount}       onChange={(e) => setAmount(e.target.value)} />
                <input type="number" placeholder="Duration in days (e.g. 7)"        value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
                <input type="text"   placeholder="Purpose of loan"                  value={purpose}      onChange={(e) => setPurpose(e.target.value)} />
              </div>
              <div className="interest-preview">
                <div>
                  <span>Standard Interest Rate</span>
                  <strong>{durationDays ? calculateInterestRate(durationDays) : 0}%</strong>
                </div>
                <div>
                  <span>Estimated Total Repayment</span>
                  <strong>{getTotalRepaymentPreview()} ETH</strong>
                </div>
              </div>
              <button onClick={createLoan} className="primary-action">
                <PlusCircle size={15} style={ic} />Create Loan
              </button>
            </section>

            {/* My loans */}
            <section className="card">
              <div className="section-header">
                <div>
                  <p className="eyebrow"><FileText size={12} style={{ verticalAlign: "middle", marginRight: 5 }} />Records</p>
                  <h2>My Loan Requests</h2>
                </div>
                <button onClick={loadLoans}><RefreshCw size={14} style={ic} />Refresh</button>
              </div>
              {myBorrowerLoans.length === 0 ? (
                <p className="empty-text">You have no loan requests yet.</p>
              ) : (
                <div className="loan-grid">
                  {myBorrowerLoans.map((loan) => (
                    <div className="loan-card" key={Number(loan.id)}>
                      <div className="loan-card-header">
                        <h3><FileText size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />Loan #{Number(loan.id)}</h3>
                        <span className={`status-pill status-${Number(loan.status)}`}>{getStatus(loan.status)}</span>
                      </div>
                      <p><strong>Amount:</strong> {ethers.formatEther(loan.amount)} ETH</p>
                      <p><strong>Interest:</strong> {Number(loan.interestRate)}%</p>
                      <p><strong>Total Repayment:</strong> {ethers.formatEther(loan.totalRepayment)} ETH</p>
                      <p><strong>Duration:</strong> {Number(loan.durationDays)} days</p>
                      <p><strong>Purpose:</strong> {loan.purpose}</p>
                      <p><strong>Lender:</strong> {loan.lender || "Not yet funded"}</p>
                      {Number(loan.status) === 0 && (
                        <button className="danger" onClick={() => cancelLoan(loan.id)}>
                          <XCircle size={14} style={ic} />Cancel Loan
                        </button>
                      )}
                      {Number(loan.status) === 1 && (
                        <button onClick={() => repayLoan(loan.id, loan.totalRepayment)}>
                          <CircleDollarSign size={14} style={ic} />Repay Loan
                        </button>
                      )}
                      {Number(loan.status) === 2 && (
                        <p className="status-paid"><CheckCircle2 size={14} style={ic} />This loan has been repaid.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* ── LENDER ── */}
        {selectedRole === "lender" && (
          <>
            {/* Lender terms */}
            <section className="card">
              <div className="section-title">
                <div>
                  <p className="eyebrow"><ScrollText size={12} style={{ verticalAlign: "middle", marginRight: 5 }} />Terms</p>
                  <h2>Lender Repayment Terms</h2>
                </div>
              </div>
              <div className="terms-grid">
                <div className="term-item"><strong><Landmark size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />Funding</strong><p>The lender must send the exact amount requested by the borrower.</p></div>
                <div className="term-item"><strong><TrendingUp size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />Expected Return</strong><p>The lender receives the original amount plus interest after repayment.</p></div>
                <div className="term-item"><strong><History size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />Loan History</strong><p>Funded loans appear in My Lending History.</p></div>
              </div>
            </section>

            {/* Marketplace */}
            <section className="card">
              <div className="section-header">
                <div>
                  <p className="eyebrow"><CircleDollarSign size={12} style={{ verticalAlign: "middle", marginRight: 5 }} />Marketplace</p>
                  <h2>Available Loan Requests</h2>
                </div>
                <button onClick={loadLoans}><RefreshCw size={14} style={ic} />Refresh</button>
              </div>
              {availableLoans.length === 0 ? (
                <p className="empty-text">No available loan requests.</p>
              ) : (
                <div className="loan-grid">
                  {availableLoans.map((loan) => (
                    <div className="loan-card" key={Number(loan.id)}>
                      <div className="loan-card-header">
                        <h3><FileText size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />Loan #{Number(loan.id)}</h3>
                        <span className={`status-pill status-${Number(loan.status)}`}>{getStatus(loan.status)}</span>
                      </div>
                      <p><strong>Borrower:</strong> {loan.borrower}</p>
                      <p><strong>Amount:</strong> {ethers.formatEther(loan.amount)} ETH</p>
                      <p><strong>Interest:</strong> {Number(loan.interestRate)}%</p>
                      <p><strong>Total Repayment:</strong> {ethers.formatEther(loan.totalRepayment)} ETH</p>
                      <p><strong>Duration:</strong> {Number(loan.durationDays)} days</p>
                      <p><strong>Purpose:</strong> {loan.purpose}</p>
                      <button onClick={() => fundLoan(loan.id, loan.amount)}>
                        <Landmark size={14} style={ic} />Fund Loan
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Lending history */}
            <section className="card">
              <div className="section-header">
                <div>
                  <p className="eyebrow"><History size={12} style={{ verticalAlign: "middle", marginRight: 5 }} />History</p>
                  <h2>My Lending History</h2>
                </div>
                <button onClick={loadLoans}><RefreshCw size={14} style={ic} />Refresh</button>
              </div>
              {myLenderLoans.length === 0 ? (
                <p className="empty-text">You have not funded any loans yet.</p>
              ) : (
                <div className="loan-grid">
                  {myLenderLoans.map((loan) => (
                    <div className="loan-card" key={Number(loan.id)}>
                      <div className="loan-card-header">
                        <h3><FileText size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />Loan #{Number(loan.id)}</h3>
                        <span className={`status-pill status-${Number(loan.status)}`}>{getStatus(loan.status)}</span>
                      </div>
                      <p><strong>Borrower:</strong> {loan.borrower}</p>
                      <p><strong>Amount Lent:</strong> {ethers.formatEther(loan.amount)} ETH</p>
                      <p><strong>Interest:</strong> {Number(loan.interestRate)}%</p>
                      <p><strong>Expected Repayment:</strong> {ethers.formatEther(loan.totalRepayment)} ETH</p>
                      <p><strong>Duration:</strong> {Number(loan.durationDays)} days</p>
                      <p><strong>Purpose:</strong> {loan.purpose}</p>
                      {Number(loan.status) === 1 && (
                        <p className="status-waiting"><Clock size={14} style={ic} />Waiting for borrower repayment.</p>
                      )}
                      {Number(loan.status) === 2 && (
                        <p className="status-paid"><CheckCircle2 size={14} style={ic} />Loan has been paid.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Paid loans */}
            <section className="card">
              <div className="section-title">
                <div>
                  <p className="eyebrow"><CheckCircle2 size={12} style={{ verticalAlign: "middle", marginRight: 5 }} />Completed</p>
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
                        <h3><CheckCircle2 size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />Paid Loan #{Number(loan.id)}</h3>
                        <span className="status-pill status-2">Repaid</span>
                      </div>
                      <p><strong>Borrower:</strong> {loan.borrower}</p>
                      <p><strong>Original Amount:</strong> {ethers.formatEther(loan.amount)} ETH</p>
                      <p><strong>Total Received:</strong> {ethers.formatEther(loan.totalRepayment)} ETH</p>
                      <p><strong>Interest Earned:</strong> {ethers.formatEther(getInterestEarned(loan))} ETH</p>
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