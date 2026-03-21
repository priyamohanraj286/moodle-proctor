// ============================================================================
// Moodle Integration Service
// Handles authentication and user sync with Moodle LMS
// ============================================================================

import axios from 'axios';
import crypto from 'crypto';
import config from '../../config';
import logger from '../../config/logger';
import { MoodleError } from '../../utils/errors';

// ============================================================================
// Types
// ============================================================================

interface MoodleTokenResponse {
  token: string;
}

interface MoodleTokenErrorResponse {
  error: string;
  errorcode?: string;
  stacktrace?: string;
  debuginfo?: string;
}

interface MoodleSiteInfo {
  userid: number;
  username: string;
  firstname?: string;
  lastname?: string;
  email: string;
  lang?: string;
  userpictureurl?: string;
  siteurl: string;
  sitename: string;
}

interface MoodleUser {
  id: number;
  username: string;
  email: string;
  firstname?: string;
  lastname?: string;
  fullname?: string;
  userpictureurl?: string;
}

// ============================================================================
// Moodle Service
// ============================================================================

class MoodleService {
  private baseUrl: string;
  private serviceShortname: string;

  constructor() {
    this.baseUrl = config.moodle.baseUrl;
    this.serviceShortname = config.moodle.serviceShortname;
  }

  /**
   * Authenticate with Moodle and get token
   */
  async authenticate(username: string, password: string): Promise<string> {
    try {
      logger.info(`Authenticating user ${username} with Moodle`);

      const params = new URLSearchParams({
        username,
        password,
        service: this.serviceShortname,
      });

      const response = await axios.post<MoodleTokenResponse | MoodleTokenErrorResponse>(
        `${this.baseUrl}/login/token.php`,
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
        }
      );

      if (response.status !== 200) {
        throw new MoodleError(`Moodle token endpoint failed (${response.status})`);
      }

      const data = response.data as MoodleTokenResponse | MoodleTokenErrorResponse;

      // Check if token is present
      if ('token' in data && typeof data.token === 'string' && data.token.length > 0) {
        logger.info(`User ${username} authenticated successfully with Moodle`);
        return data.token;
      }

      // Check if error is present
      if ('error' in data && typeof data.error === 'string') {
        const code = data.errorcode ? ` (${data.errorcode})` : '';
        throw new MoodleError(`${data.error}${code}`);
      }

      throw new MoodleError('Unexpected Moodle response from token endpoint');
    } catch (error) {
      if (error instanceof MoodleError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        throw new MoodleError(
          `Failed to connect to Moodle: ${error.message}`,
          503
        );
      }

      logger.error('Moodle authentication error:', error);
      throw new MoodleError('Authentication failed');
    }
  }

  /**
   * Validate token and get site info
   */
  async validateToken(token: string): Promise<MoodleSiteInfo> {
    try {
      const params = new URLSearchParams({
        wstoken: token,
        wsfunction: 'core_webservice_get_site_info',
        moodlewsrestformat: 'json',
      });

      const response = await axios.get<MoodleSiteInfo | { exception: string; message?: string; errorcode?: string }>(
        `${this.baseUrl}/webservice/rest/server.php`,
        { params }
      );

      if (response.status !== 200) {
        throw new MoodleError(`Moodle REST server failed (${response.status})`);
      }

      const data = response.data;

      // Check for exception
      if ('exception' in data) {
        const msg = typeof data.message === 'string' ? data.message : 'Moodle exception';
        const code = data.errorcode ? ` (${data.errorcode})` : '';
        throw new MoodleError(`${msg}${code}`);
      }

      // Return site info (this is the successful case)
      if ('userid' in data && typeof data.userid === 'number') {
        return data as MoodleSiteInfo;
      }

      throw new MoodleError('Unexpected Moodle response from site info');
    } catch (error) {
      if (error instanceof MoodleError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        throw new MoodleError(
          `Failed to validate token with Moodle: ${error.message}`,
          503
        );
      }

      logger.error('Moodle token validation error:', error);
      throw new MoodleError('Token validation failed');
    }
  }

  /**
   * Sync user from Moodle to database
   * Returns user role (student or teacher)
   */
  async syncUser(moodleToken: string, siteInfo: MoodleSiteInfo): Promise<{
    userId: number;
    role: 'student' | 'teacher';
  }> {
    // For now, we'll do a simple role determination
    // In production, you might want to call Moodle APIs to get user roles
    // For this implementation, we'll treat all users as students by default
    // Teachers can be manually promoted in the database or via Moodle role checks

    // TODO: Implement proper role detection via Moodle API
    // Potential approach: Call core_enrol_get_users_courses and check for editing teacher role

    const role: 'student' | 'teacher' = 'student'; // Default to student

    // TODO: Store/update user in database via user service
    // This will be implemented when we create the user service

    return {
      userId: siteInfo.userid,
      role,
    };
  }

  /**
   * Get Moodle user info from token
   */
  async getUserInfo(token: string): Promise<MoodleUser> {
    const siteInfo = await this.validateToken(token);

    return {
      id: siteInfo.userid,
      username: siteInfo.username,
      email: siteInfo.email,
      firstname: siteInfo.firstname,
      lastname: siteInfo.lastname,
      fullname: `${siteInfo.firstname || ''} ${siteInfo.lastname || ''}`.trim(),
      userpictureurl: siteInfo.userpictureurl,
    };
  }
}

// Export singleton instance
export default new MoodleService();
