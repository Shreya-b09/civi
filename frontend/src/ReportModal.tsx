import React, { useState, useEffect } from 'react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose }) => {
  const [activeCard, setActiveCard] = useState<'auth' | 'otp' | 'report' | 'rewards'>('auth');
  const [user, setUser] = useState<any>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [rewardUserId, setRewardUserId] = useState('');
  const [showRewards, setShowRewards] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [detectionResult, setDetectionResult] = useState<string | null>(null);
  const [annotatedImage, setAnnotatedImage] = useState<string | null>(null);
  const [violationType, setViolationType] = useState<string>('');

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setActiveCard('report');
    }
  }, []);

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (/^\d{10}$/.test(phoneNumber)) {
      // Mock OTP generation (replace with real SMS API in production)
      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(newOtp);
      console.log(`Your OTP is: ${newOtp}`); // Mock SMS - check console
      setActiveCard('otp');
    } else {
      alert('Please enter a valid 10-digit phone number');
    }
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp === generatedOtp) {
      const userData = { phone: phoneNumber, credits: 1000 }; // Start with 1000 credits
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      setActiveCard('report');
    } else {
      alert('Invalid OTP. Please try again.');
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
      setDetectionResult(null);
      setAnnotatedImage(null);
    }
  };

  const handleViolationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setViolationType(e.target.value);
    setDetectionResult(null);
    setAnnotatedImage(null);
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.credits < 10) {
      alert('Insufficient credits! Please contact support.');
      return;
    }
    if (!violationType) {
      alert('Please select a violation type.');
      return;
    }

    const updatedUser = { ...user, credits: user.credits - 10 };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);

    if (imageFile && violationType === 'No Parking') {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('violationType', violationType);
      formData.append('phone', user.phone); // Tie report to phone

      try {
        const response = await fetch('http://localhost:5001/detect', {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) throw new Error('Detection failed');
        const data = await response.json();
        setDetectionResult(data.result);
        setAnnotatedImage(data.image);
        if (data.detected) {
          const rewardedUser = { ...updatedUser, credits: updatedUser.credits + 10 };
          localStorage.setItem('user', JSON.stringify(rewardedUser));
          setUser(rewardedUser);
        }
      } catch (error) {
        console.error('Detection error:', error);
        setDetectionResult('Error detecting violation');
      }
    } else if (violationType === 'No Helmet') {
      setDetectionResult('No Helmet detection not yet implemented');
    }
  };

  const handleRewardsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (user && user.phone === rewardUserId) {
      setShowRewards(true);
    } else {
      alert('Invalid Phone Number. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="relative bg-gradient-to-br from-[#1a365f] to-[#0f4c75] p-4 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto text-white">
        <button onClick={onClose} className="absolute top-2 right-2 text-white text-xl">✕</button>
        <div className="flex justify-center gap-4 mb-4">
          <button
            onClick={() => setActiveCard('auth')}
            className={`px-4 py-2 rounded ${activeCard === 'auth' || activeCard === 'otp' ? 'bg-[#00ff88] text-[#1a365f]' : ''}`}
          >
            Login
          </button>
          <button
            onClick={() => user && setActiveCard('report')}
            className={`px-4 py-2 rounded ${activeCard === 'report' ? 'bg-[#00ff88] text-[#1a365f]' : ''}`}
            disabled={!user}
          >
            Report
          </button>
          <button
            onClick={() => user && setActiveCard('rewards')}
            className={`px-4 py-2 rounded ${activeCard === 'rewards' ? 'bg-[#00ff88] text-[#1a365f]' : ''}`}
            disabled={!user}
          >
            Rewards
          </button>
        </div>

        {/* Phone Number Entry */}
        {activeCard === 'auth' && (
          <div className="auth-card p-6">
            <div className="text-center mb-4">
              <img src="https://img.icons8.com/fluency/96/000000/security-checked.png" alt="Security" />
              <h2 className="mt-3 text-2xl font-bold">Secure Login</h2>
            </div>
            <form onSubmit={handlePhoneSubmit}>
              <div className="mb-4">
                <label className="block text-sm mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  pattern="\d{10}"
                  placeholder="Enter 10-digit phone number"
                  required
                  className="w-full p-3 rounded-lg bg-white/5 text-white border-none focus:ring-2 focus:ring-[#00ff88]"
                />
              </div>
              <button type="submit" className="w-full bg-[#00ff88] text-[#1a365f] p-3 rounded-lg font-semibold hover:bg-opacity-90">
                Send OTP <i className="fas fa-phone ml-2"></i>
              </button>
            </form>
          </div>
        )}

        {/* OTP Verification */}
        {activeCard === 'otp' && (
          <div className="otp-card p-6">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold">Enter OTP</h2>
              <p className="text-gray-300">Check console for your OTP</p>
            </div>
            <form onSubmit={handleOtpSubmit}>
              <div className="mb-4">
                <label className="block text-sm mb-1">OTP</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  pattern="\d{6}"
                  placeholder="Enter 6-digit OTP"
                  required
                  className="w-full p-3 rounded-lg bg-white/5 text-white border-none focus:ring-2 focus:ring-[#00ff88]"
                />
              </div>
              <button type="submit" className="w-full bg-[#00ff88] text-[#1a365f] p-3 rounded-lg font-semibold hover:bg-opacity-90">
                Verify OTP <i className="fas fa-check ml-2"></i>
              </button>
            </form>
          </div>
        )}

        {/* Reporting Card */}
        {activeCard === 'report' && user && (
          <div className="report-card p-6">
            <div className="absolute top-4 right-12 bg-green-500/10 px-3 py-1 rounded-lg">
              <i className="fas fa-coins mr-2"></i>
              <span>{user.credits} Credits</span>
            </div>
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold">Report Violation</h2>
              <p className="text-gray-300">Help make our roads safer</p>
            </div>
            <form onSubmit={handleReportSubmit}>
              <div className="mb-4">
                <label className="block text-sm mb-1">Phone Number</label>
                <input
                  type="text"
                  defaultValue={user.phone}
                  readOnly
                  className="w-full p-3 rounded-lg bg-white/5 text-white border-none"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm mb-1">Violation Type</label>
                <select
                  value={violationType}
                  onChange={handleViolationChange}
                  className="w-full p-3 rounded-lg bg-white/5 text-white border-none focus:ring-2 focus:ring-[#00ff88]"
                  required
                >
                  <option value="">Select violation type</option>
                  <option value="No Helmet">No Helmet</option>
                  <option value="No Parking">No Parking</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm mb-1">Location</label>
                <input
                  type="text"
                  className="w-full p-3 rounded-lg bg-white/5 text-white border-none focus:ring-2 focus:ring-[#00ff88]"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm mb-1">Description</label>
                <textarea
                  className="w-full p-3 rounded-lg bg-white/5 text-white border-none focus:ring-2 focus:ring-[#00ff88]"
                  rows={3}
                  required
                ></textarea>
              </div>
              <div className="mb-4">
                <label className="block text-sm mb-1">Upload Evidence</label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="w-full text-white"
                  />
                </div>
              </div>
              {detectionResult && (
                <div className="mb-4 text-center">
                  <p className="text-green-300">{detectionResult}</p>
                  {annotatedImage && (
                    <div className="mt-2">
                      <img
                        src={annotatedImage}
                        alt="Detected Violation"
                        className="max-w-full h-auto rounded-lg border border-gray-300 mx-auto"
                      />
                    </div>
                  )}
                </div>
              )}
              <button type="submit" className="w-full bg-[#00ff88] text-[#1a365f] p-3 rounded-lg font-semibold hover:bg-opacity-90">
                Submit Report <i className="fas fa-paper-plane ml-2"></i>
              </button>
            </form>
          </div>
        )}

        {/* Rewards Card */}
        {activeCard === 'rewards' && user && (
          <div className="rewards-card p-6">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold">View Rewards</h2>
              <p className="text-gray-300">Check your earned credits</p>
            </div>
            <form onSubmit={handleRewardsSubmit}>
              <div className="mb-4">
                <label className="block text-sm mb-1">Phone Number</label>
                <input
                  type="text"
                  value={rewardUserId}
                  onChange={(e) => setRewardUserId(e.target.value)}
                  className="w-full p-3 rounded-lg bg-white/5 text-white border-none focus:ring-2 focus:ring-[#00ff88]"
                  required
                />
              </div>
              <button type="submit" className="w-full bg-[#00ff88] text-[#1a365f] p-3 rounded-lg font-semibold hover:bg-opacity-90">
                View Rewards <i className="fas fa-coins ml-2"></i>
              </button>
            </form>
            {showRewards && (
              <div className="mt-4 text-center">
                <h4>Phone: <span>{user.phone}</span></h4>
                <h4>Credits: <span>{user.credits}</span></h4>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportModal;